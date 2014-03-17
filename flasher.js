#!/usr/bin/env node

/*
  Copyright 2014 Marc Juul
  License: GPLv3

  This file is part of ubi-flasher.

  ubi-flasher is free software: you can redistribute it and/or modify
  it under the terms of the GNU General Public License as published by
  the Free Software Foundation, either version 3 of the License, or
  (at your option) any later version.

  ubi-flasher is distributed in the hope that it will be useful,
  but WITHOUT ANY WARRANTY; without even the implied warranty of
  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
  GNU General Public License for more details.

  You should have received a copy of the GNU General Public License
  along with ubi-flasher. If not, see <http://www.gnu.org/licenses/>.
*/

var fs = require('fs');
var request = require('request');
var cheerio = require('cheerio');
var sleep = require('sleep').sleep;
var argv = require('optimist').argv;

var username = argv.user || argv.username || 'ubnt';
var password = argv.pass || argv.password || 'ubnt';

var ip = argv.ip || '192.168.1.20';

var host = 'http://'+ip;

if(!argv.firmware) {
    // should be stderr
    console.log("You must supply firmware filename with --firmware");
    process.exit(1);
}

var firmware_file = argv.firmware;

function debug(str) {
    if(argv.debug) {
        console.log("[DEBUG]: " + str);
    }
}

function confirm_upload(cb) {
    var r = request.post({
        uri: host+'/fwflash.cgi',
        jar: true
    }, function(err, resp, body) {
        if(err) return cb(err);
        if(resp.statusCode != 200) {
            return cb("error: got unexpected response for while trying to flash firmware: "+ resp.statusCode);
        }
        cb(null);
    });
}

function upload_firmware(cb) {

    var firmware = fs.readFileSync(firmware_file);

    var r = request.post({
        uri: host+'/upgrade.cgi',
        jar: true
    }, function(err, resp, body) {
        if(err) return cb(err);
        if(resp.statusCode != 200) {
            return cb("Error: got unexpected response for while trying to upload firmware: "+ resp.statusCode);
        }
        console.log("Firmware uploaded successfully.");
        confirm_upload(cb);
    });

    var form = r.form();

    form.append('fwfile', firmware, {
        header: "--" + form.getBoundary() + "\r\n" + "Content-Disposition: form-data; name=\"fwfile\"; filename=\"firmware.bin\"\r\nContent-Type: application/octet-stream\r\n\r\n"
    });

    console.log("Sending firmware");
}

// url is e.g. /index.cgi
function get(url, cb) {
    request({
        method: 'GET',
        uri: host+url, 
        jar: true,
    }, function(err, resp, body) {
        if(err) throw("error: " + err);
        if(resp.statusCode != 200) {
            throw("error: got unexpected response for " + url + ": " + resp.statusCode + "\n\n" + body );
        }
        if(cb) {
            cb(resp, body);
        }
    });    
}

// log in using the initial login screen
// (the one you get if you've never logged in before)
function login_initial(cb) {

    var r = request.post({
        uri: host+'/login.cgi',
        jar: true,
        rejectUnauthorized: true,
        strictSSL: false
    }, function(err, resp, body) {
        if(err) throw("Error: " + err);
        if(resp.statusCode != 302) {
            throw("Error: Got unexpected response: " + resp.statusCode + "\n\n" + body);
        }
        debug("Login appears to have been successful");

        get('/upgrade.cgi', function(resp, body) {
            upload_firmware(cb);
        });

    });

    // it looks weird that this is done after 
    // the request.post call but it actually works 
    // as expected and is the correct way to do this. 
    // It works because the request.post isn't fired
    // until the next tick of the event loop
    var form = r.form();
    form.append('username', username);
    form.append('password', password);
    form.append('country_select', '840');
    form.append('country', '840');
    form.append('ui_language', 'en_US');
    form.append('agreed', 'true');
}

// log in using the initial login screen
// (the one you get if you've never logged in before)
function login_normal(cb) {
    var r = request.post({
        uri: host+'/login.cgi',
        jar: true
    }, function(err, resp, body) {
        if(err) return cb(err);

        if(resp.statusCode != 302) {
            return cb("Error: Got unexpected response: " + resp.statusCode + "\n\n" + body);
        }

        // TODO check for failed login

        get('/upgrade.cgi', function(resp, body) {
            upload_firmware(cb);
        });
    });

    var form = r.form();
    form.append('username', username);
    form.append('password', password);
    form.append('uri', '');
}

// hack based on:
// https://github.com/mikeal/request/issues/418
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

function flash(url, cb) {

    debug("Accessing " + url);

    request({
        method: 'GET',
        uri: url,
        jar: true,
        rejectUnauthorized: true,
        strictSSL: false
    }, function(err, resp, body) {
        if(err) return cb(err);
        if(resp.statusCode != 200) {
            return cb("error: got unexpected response with status: " + resp.statusCode + "\n\n and body:" + body );
        }
        
        // if not already using https, check if the server wants us to switch to https and then switch
        if(!url.match(/^https/)) {
            if(resp.request && resp.request.uri && (resp.request.uri.protocol.match(/^https/))) {
                debug("Switching to https");
                host = 'https://'+ip;
                flash(url.replace(/^http/, 'https'), cb);
                return;
            }
        }
        
        $ = cheerio.load(body);
        if(!$('#username')) {
            throw("login page different from what was expected");
        }
        debug("Looks like a login page.");
        if($('#country_select').length > 0) {
            debug("Looks like an older (802.11g) router and it's asking us to select country.");
            login_initial(cb);
        } else if($('#country').length > 0) {
            debug("Looks like a newer (802.11n) router and it's asking us to select country.");
            login_initial(cb);
        } else {
            debug("Router is not asking us to select country.");
            login_normal(cb);
        }
        
    });
}

function main() {

    var login_url = host+'/login.cgi';

    flash(login_url, function(err) {
        if(err) {
            if(argv.retryonfail) {
//            if((err.code == 'ECONNREFUSED') || (err.code == 'ENETUNREACH') || (err.code == 'EHOSTUNREACH')) {

                var seconds = parseInt(argv.retryonfail);
                seconds = (seconds >= 0) ? seconds : 5;
                console.log("Could not connect. Retrying in " + seconds + " seconds.");
                sleep(seconds);
                console.log("Retrying.");
                main();
                return;
//                }
            }
            console.log(err);
            return;
        }

        console.log("Firmware flashing begun!");
        console.log("In a few seconds, the router should begin flashing its four status LEDs sweeping from left to right, then right to left (or up down, down up).");
        console.log("This means that the router is flashing itself with the new firmware.");
        console.log("Once the router goes back to having only the power LED lit, the router has been successfully flashed.");

        if(argv.retryonsuccess) {
            var seconds = parseInt(argv.retryonsuccess);
            seconds = (seconds >= 0) ? seconds : 20;
            console.log("Will wait "+seconds+" before attempting to flash another device.");
            sleep(seconds);
            console.log("Retrying.");
            main();
            return;
        }
    });   
}

main();