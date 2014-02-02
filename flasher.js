#!/usr/bin/env node

// Copyright 2014 Marc Juul
// License: GPLv3

var fs = require('fs');
var request = require('request');
var cheerio = require('cheerio');
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

function confirm_upload() {
    var r = request.post({
        uri: host+'/fwflash.cgi',
        jar: true
    }, function(err, resp, body) {
        if(err) throw("Error: " + err);
        if(resp.statusCode != 200) {
            throw("error: got unexpected response for while trying to flash firmware: "+ resp.statusCode);
        }
        console.log("Firmware flashing begun.");
    });
}

function upload_firmware() {

    var firmware = fs.readFileSync(firmware_file);

    var r = request.post({
        uri: host+'/upgrade.cgi',
        jar: true
    }, function(err, resp, body) {
        if(err) throw("Error: " + err);
        if(resp.statusCode != 200) {
            throw("error: got unexpected response for while trying to upload firmware: "+ resp.statusCode);
        }
        console.log("Firmware uploaded successfully.");
        confirm_upload();
    });

    var form = r.form();

    form.append('fwfile', firmware, {
        header: "--" + form.getBoundary() + "\r\n" + "Content-Disposition: form-data; name=\"fwfile\"; filename=\"firmware.bin\"\r\nContent-Type: application/octet-stream\r\n\r\n"

    });

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
function login_initial() {
    var r = request.post({
        uri: host+'/login.cgi',
        jar: true
    }, function(err, resp, body) {
        if(err) throw("Error: " + err);
        if(resp.statusCode != 302) {
            throw("Error: Got unexpected response: " + resp.statusCode + "\n\n" + body);
        }

        get(resp.headers.location, function(resp, body) {
            upload_firmware();
        });

    });

    // it looks weird that this is done after 
    // the request.post call but it actually works 
    // as expected and is the correct way to do this. 
    // It works because the request.post isn't fired
    // until the next tick of the vent loop
    var form = r.form();
    form.append('username', username);
    form.append('password', password);
    form.append('country_select', '840');
    form.append('country', '840');
    form.append('ui_language', 'en_US');
    
}

// log in using the initial login screen
// (the one you get if you've never logged in before)
function login_normal() {
    var r = request.post({
        uri: host+'/login.cgi',
        jar: true
    }, function(err, resp, body) {
        if(err) throw("Error: " + err);

        if(resp.statusCode != 302) {
            throw("Error: Got unexpected response: " + resp.statusCode + "\n\n" + body);
        }

        // TODO check for failed login

        get('/upgrade.cgi', function(resp, body) {
            upload_firmware();
        });
    });

    var form = r.form();
    form.append('username', username);
    form.append('password', password);
    form.append('uri', '');
}


request({
    method: 'GET',
    uri: host+'/login.cgi',
    jar: true,
}, function(err, resp, body) {
    if(err) throw("error: " + err);
    if(resp.statusCode != 200) {
        throw("error: got unexpected response " + resp.statusCode + "\n\n" + body );
    }
    $ = cheerio.load(body);
    if(!$('#username')) {
        throw("login page different from what was expected");
    }
    if($('#country_select').length > 0) {
        login_initial();
    } else {
        login_normal();
    }

});
        