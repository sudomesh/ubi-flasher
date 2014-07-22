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
var os = require('os');
var path = require('path');
var request = require('request');
var cheerio = require('cheerio');
var sleep = require('sleep').sleep;
var argv = require('optimist').argv;
var tftp = require('tftp');
var Netmask = require('netmask').Netmask;

// hack based on:
// https://github.com/mikeal/request/issues/418
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

var username = argv.user || argv.username || 'ubnt';
var password = argv.pass || argv.password || 'ubnt';

var ip = argv.ip || '192.168.1.20';

var host = 'http://'+ip;

if(!argv.firmware) {
    // should be stderr
    console.log('');
    console.log("Usage: flasher.js --firmware <firmware.bin|directory>")
    console.log('');
    console.log(" --ip <ip_address>: Set IP of router (default: 192.168.1.20)");
    console.log('');
    console.log(" --tftp: Attempt to flash using tftp only (no web flashing)");
    console.log('');
    console.log(" --web: Attempt to flash using web only (no tftp flashing)");
    console.log('');
    console.log(" --fs <squashfs|jffs2>: If using a directory as --firmware argument,");
    console.log("                        select squashfs or jffs2 images (default: squashfs or jffs2)")
    console.log('');
    console.log(" --debug: Enable verbose debug output");
    console.log('');
    console.log(" --retryonfail [seconds]: Retry after a failed attempt (default: disabled)");
    console.log("                          Optionally set seconds to wait before retrying.");
    console.log('');
    console.log(" --retryonsuccess [seconds]: Retry after successful flashing (default: disabled)");
    console.log("                             Optionally set seconds to wait before retrying.");
    console.log('');
    console.log("If a directory is specified as the --firmware argument, then the directory");
    console.log("is expected to contain one or more OpenWRT images with the standard naming.")
    console.log("Note that tftp flashing will be disabled if a directory is specified,");
    console.log("since it is not possible to auto-detect router model via tftp.");
    console.log('');
    process.exit(1);
}

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

function select_firmware(model, dir, fs) {
    fs = fs || '';
    var regex = null;
    if(model.match(/rocket/i)) {
        regex = new RegExp("rocket.*m.*"+fs+".*factory.*bin$", 'i');
    } else if(model.match(/nano/i)) {
        regex = new RegExp("nano.*m.*"+fs+".*factory.*bin$", 'i');
    } else if(model.match(/bullet/i)) {
        regex = new RegExp("bullet.*m.*"+fs+".*factory.*bin$", 'i');
    } else if(model.match(/unifi.*outdoor/i)) {
        regex = new RegExp("unifi.*outdoor.*"+fs+".*factory.*bin$", 'i');
    } else if(model.match(/unifi/i)) {
        regex = new RegExp("unifi.*"+fs+".*factory.*bin$", 'i');
    } else {
        return null;
    }

    var files = fs.readdirSync(dir);
    var i, file;
    for(i=0; i < files.length; i++) {
        file = files[i];
        debug("Checking: " + file);
        if(file.match(regex)) {
            debug("Found firmware file matching router model: " + file);
            return path.resolve(path.join(dir, file));
        }
    }
    return null;
}

function upload_firmware(model, cb) {

    var firmware_path;
    var stats = fs.statSync(argv.firmware);

    if(stats.isDirectory()) {
        firmware_path = select_firmware(model, argv.firmware, argv.fs);
        if(!firmware_path) {
            return cb("Error: Could not find the correct firmware for your device in the supplied directory. This could just be a failing of ubi-flasher.");
        }
    } else if(stats.isFile()) {
        firmware_path = argv.firmware;
    } else {
        return cb("Error: Specified firmware path is neither a directory nor a file");
    }

    var firmware = fs.readFileSync(firmware_path);

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
        if(err) return cb(err);
        if(resp.statusCode != 200) {
            return cb("error: got unexpected response for " + url + ": " + resp.statusCode + "\n\n" + body );
        }
        if(cb) {
            cb(null, resp, body);
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
        
        check_model(cb);

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

        check_model(cb);
    });

    var form = r.form();
    form.append('username', username);
    form.append('password', password);
    form.append('uri', '');
}

function check_model(cb) {

    get('/index.cgi', function(err, resp, body) {
        if(err) return cb(err);

        $ = cheerio.load(body);
        var model = null;

        var title = $('title');
        if(title && (title.length >= 1)) {
            title = title.html();
            if(title && (title != '')) {
                debug("<title> tag conatins: " + title);
                var m = title.match(/\[([^\]]+)\]/);
                if(m && (m.length >= 1)) {
                    model = m[1];
                }
            }
        }

        if(model) {
            console.log("Identified router model as: " + model);
        } else {
            console.log("Could not identify router model.");
        }

        get('/upgrade.cgi', function(err, resp, body) {
            if(err) return cb(err);
            upload_firmware(model, cb);
        });

    });

}

function webflash(host, cb) {

    var url = host+'/login.cgi';

    console.log("Accessing " + url);
    
    request({
        method: 'GET',
        uri: url,
        jar: true,
        timeout: 10000, // 10 second timeout
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



function tftpflash(callback) {
    var stats = fs.statSync(argv.firmware);
    if(stats.isDirectory()) {
        if(argv.tftp) {
            console.error("Automatic firmware selection is not possible using tftp.")
            console.error("Please specify a file with --firmware instead of a directory.");
            return false;
        } else {
            debug("Automatic firmware selection is not possible using tftp. Skipping.")
            return false;
        }
    }


    var client = tftp.createClient({
        host: ip
    });

    console.log("Sending "+ argv.firmware + " to " + ip + " using tftp put");

    client.put(argv.firmware, function(error) {
        if(error) {
            return callback(error);
        }
        callback(null);
    });
}

function flash(newRouter) {

    if(argv.tftp) {
        tftpflash(flash_callback);
    } else if(argv.web) {
        webflash(host, flash_callback);
    } else {
        webflash(host, function(err) {
            if(err) {
                nice_error(err);
                tftpflash(flash_callback);
            }
        })
    }
}

function nice_error(err) {
    if(err.code == 'ETIMEDOUT') {
        console.error("Connection timed out");
    } else if(err.code == 'EHOSTUNREACH') {
        console.error("Host unreachable");
    } else if(err.code == 'ECONNREFUSED') {
        console.error("Connection refused");
    } else {
        console.error(err);
    }
}

function flash_callback(err) {
        if(err) {
            nice_error(err);
            if(argv.retryonfail) {
                var seconds = parseInt(argv.retryonfail);
                seconds = (seconds >= 0) ? seconds : 5;
                console.log("Could not connect. Retrying in " + seconds + " seconds.");
                sleep(seconds);
                console.log("Retrying.");
                flash();
                return;
            }
            return;
        }

        console.log("Firmware flashing begun!");
        console.log("The firmware has been successfully sent to the router.");
        console.log("In a few seconds, the router should begin flashing its four status LEDs sweeping from left to right, then right to left (or up down, down up).");
        console.log("This means that the router is flashing itself with the new firmware.");
        console.log("Once the router goes back to having only the power LED lit, the router has been successfully flashed.");

        if(argv.retryonsuccess) {
            var seconds = parseInt(argv.retryonsuccess);
            seconds = (seconds >= 0) ? seconds : 20;
            console.log("Will wait "+seconds+" before attempting to flash another device.");
            sleep(seconds);
            console.log("Retrying.");
            flash();
            return;
        }
}

function checkNetworkConfig() {
    if(!os.networkInterfaces) {
        console.log("Remember to give you ethernet interface a static IP in the range 192.168.1.x (and not "+ip+") and ensure that no other network interfaces have an IP in the same range (hint: Turn off your wifi to be sure).");
        return true;
    }
    var found = 0;
    var ifaces = os.networkInterfaces();
    var i, iface, addrs, addr, netmask;
    for(iface in ifaces) {
        addrs = ifaces[iface];
        for(i=0; i < addrs.length; i++) {
            addr = addrs[i];
            if(addr.internal || addr.family != 'IPv4') continue;

            if(addr.address == ip) {
                console.error("Error: Your network adapater "+iface+" has the same IP as the router ("+ip+"). Flashing is not possible. Aborting.");
                return false;
            }

            if(!addr.netmask) {
                // node pre 0.11 did not include netmask so make assumptions
                if(addr.address.match(/^10\./)) {
                    addr.netmask = '255.0.0.0';
                } else {
                    addr.netmask = '255.255.255.0';
                }
            }
            var block = new Netmask(addr.address+'/'+addr.netmask);
            if(block.contains(ip)) {
                found += 1;
                break;
            }
        }
    }

    if(found == 0) {
        console.error("========= WARNING =========");
        console.error("It looks like you don't have any network interfaces configured with an IP on the same subnet as the router you are trying to flash ("+ip+"). Flashing is likely to fail. Consult the README if you are confused. Proceeding anyway in case you know what you are doing.");
        console.error('');
    } else if(found > 1) {
        console.error("========= WARNING =========");
        console.error("It looks like you have more than one network interfaces configured with an IP on the same subnet as the router you are trying to flash ("+ip+"). Flashing is likely to fail. Consult the README if you are confused. Proceeding anyway in case you know what you are doing.");
        console.error('');
    }

    return true;
}

if(checkNetworkConfig()) {
    flash();
}
