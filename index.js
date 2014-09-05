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
var tftp = require('tftp');
var Netmask = require('netmask').Netmask;

// hack based on:
// https://github.com/mikeal/request/issues/418
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

function UbiFlasher() {

    this.opts = null;

    this.debug = function(str, opts) {
        if(this.opts && this.opts.debug) {
            console.log("[DEBUG]: " + str);
        }
    };

    this.confirm_upload = function(cb) {
        var r = request.post({
            uri: this.opts.host+'/fwflash.cgi',
            jar: true
        }, function(err, resp, body) {
            if(err) return cb(err);
            if(resp.statusCode != 200) {
                return cb("error: got unexpected response for while trying to flash firmware: "+ resp.statusCode);
        }
            cb(null);
        });
    };

    this.select_firmware = function(model, dir, fs, callback) {
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
        
        fs.readdir(dir, function(err, files) {
            var i, file;
            for(i=0; i < files.length; i++) {
                file = files[i];
                this.debug("Checking: " + file);
                if(file.match(regex)) {
                    this.debug("Found firmware file matching router model: " + file);
                    callback(null, path.resolve(path.join(dir, file)));
                    return;
                }
            }
            callback(null, null);
        });
    };

    this.upload_firmware = function(model, cb) {

        fs.stat(this.opts.firmware, function(err, stats) {
            if(err) return cb(err);
            
            if(stats.isDirectory()) {
                this.select_firmware(model, this.opts.firmware, this.opts.fs, function(err, firmware_path) {
                    if(!firmware_path) {
                        return cb("Error: Could not find the correct firmware for your device in the supplied directory. This could just be a failing of ubi-flasher.");
                    }
                    
                    this.begin_upload(firmware_path, cb);
                    
                }.bind(this));
                return;
            } else if(stats.isFile()) {
                
                this.begin_upload(this.opts.firmware, cb);
                
            } else {
                return cb("Error: Specified firmware path is neither a directory nor a file");
            }
        }.bind(this));
    };

    this.begin_upload = function(firmware_path, cb) {

        fs.readFile(firmware_path, function(err, data) {
            if(err) return cb(err);
            
            var r = request.post({
                uri: this.opts.host+'/upgrade.cgi',
                jar: true
            }, function(err, resp, body) {
                if(err) return cb(err);
                if(resp.statusCode != 200) {
                    return cb("Error: got unexpected response for while trying to upload firmware: "+ resp.statusCode);
                }
                console.log("Firmware uploaded successfully.");
                this.confirm_upload(cb);
            }.bind(this));
            
            var form = r.form();
            
            form.append('fwfile', data, {
                header: "--" + form.getBoundary() + "\r\n" + "Content-Disposition: form-data; name=\"fwfile\"; filename=\"firmware.bin\"\r\nContent-Type: application/octet-stream\r\n\r\n"
            });
            
            console.log("Sending firmware");
        }.bind(this));
    };


    // url is e.g. /index.cgi
    this.get = function(url, cb) {
        request({
            method: 'GET',
            uri: this.opts.host+url, 
            jar: true,
        }, function(err, resp, body) {
            if(err) return cb(err);
            if(resp.statusCode != 200) {
                return cb("error: got unexpected response for " + url + ": " + resp.statusCode + "\n\n" + body );
            }
            if(cb) {
                cb(null, resp, body);
            }
        }.bind(this));    
    };

    // log in using the initial login screen
    // (the one you get if you've never logged in before)
    this.login_initial = function(cb) {
        
        console.log("Posting to: " + this.opts.host+'/login.cgi');
        
        var r = request.post({
            uri: this.opts.host+'/login.cgi',
            jar: true,
            rejectUnauthorized: true,
            strictSSL: false,
            //        followAllRedirects: true
        }, function(err, resp, body) {
            if(err) throw("Error: " + err);
            if(resp.statusCode != 302) {
                throw("Error: Got unexpected response: " + resp.statusCode + "\n\n" + body);
            }
            this.debug("Login appears to have been successful.");
            
            this.check_model(cb);
            
        }.bind(this));
        
        
        // it looks weird that this is done after 
        // the request.post call but it actually works 
        // as expected and is the correct way to do this. 
        // It works because the request.post isn't fired
        // until the next tick of the event loop
        var form = r.form();
        form.append('username', this.opts.username);
        form.append('password', this.opts.password);
        form.append('country_select', '840');
        form.append('country', '840');
        form.append('ui_language', 'en_US');
        form.append('agreed', 'true');
        form.append('lang_changed', 'no');
        form.append('uri', '/');
    };

    // log in using the initial login screen
    // (the one you get if you've never logged in before)
    this.login_normal = function(cb) {
        var r = request.post({
            uri: this.opts.host+'/login.cgi',
            jar: true
        }, function(err, resp, body) {
            if(err) return cb(err);
            
            if(resp.statusCode != 302) {
                return cb("Error: Got unexpected response: " + resp.statusCode + "\n\n" + body);
            }
            
            // TODO check for failed login
            
            this.check_model(cb);
        }.bind(this));
        
        var form = r.form();
        form.append('username', this.opts.username);
        form.append('password', this.opts.password);
        form.append('uri', '');
    };

    this.check_model = function(cb) {
        
        this.get('/index.cgi', function(err, resp, body) {
            if(err) return cb(err);
            
            $ = cheerio.load(body);
            var model = null;
            
            var title = $('title');
            if(title && (title.length >= 1)) {
                title = title.html();
                if(title && (title != '')) {
                    this.debug("<title> tag contains: " + title);
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
            
            this.get('/upgrade.cgi', function(err, resp, body) {
                if(err) return cb(err);
                this.upload_firmware(model, cb);
            }.bind(this)); 
        }.bind(this));
    };

    this.webflash = function(cb) {
        
        var url = this.opts.host+'/login.cgi';
        
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
                    this.debug("Switching to https");
                    this.opts.host = this.opts.host.replace(/^http/, 'https');
                    this.webflash(cb);
                    return;
                }
            }
            
            $ = cheerio.load(body);
            if(!$('#username')) {
                throw("login page different from what was expected");
            }
            this.debug("Looks like a login page.");
            if($('#country_select').length > 0) {
                this.debug("Looks like an older (802.11g) router and it's asking us to select country.");
                this.login_initial(cb);
            } else if($('#country').length > 0) {
                this.debug("Looks like a newer (802.11n) router and it's asking us to select country.");
                this.login_initial(cb);
            } else {
                this.debug("Router is not asking us to select country.");
                this.login_normal(cb);
            }        
        }.bind(this));
    };



    this.tftpflash = function(callback) {
        fs.stat(this.opts.firmware, function(err, stats) {
            if(err) return callback(err);
            
            if(stats.isDirectory()) {
                if(this.opts.tftp) {
                    console.error("Automatic firmware selection is not possible using tftp.")
                    console.error("Please specify a file with --firmware instead of a directory.");
                    return callback(err);
                } else {
                    this.debug("Automatic firmware selection is not possible using tftp. Skipping.")
                    return callback(err);
                }
            }
            
            
            var client = tftp.createClient({
                host: this.opts.ip
            });
            
            console.log("Sending "+ this.opts.firmware + " to " + this.opts.ip + " using tftp put");
            
            client.put(this.opts.firmware, function(error) {
                if(error) {
                    return callback(error);
                }
                callback(null);
            }.bind(this));
        }.bind(this));
    };


    this.flash = function(opts, cb) {
        this.opts = this.opts || opts || {};

        // hack based on:
        // https://github.com/mikeal/request/issues/418
        process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

        this.opts.username = this.opts.username || this.opts.user || 'ubnt';
        this.opts.password = this.opts.password || this.opts.pass || 'ubnt';

        this.opts.ip = this.opts.ip || '192.168.1.20';
        
        this.opts.host = 'http://'+this.opts.ip;


        cb = cb || function() {};
        if(!this.checkNetworkConfig()) {
            return;
        };

        if(this.opts.tftp) {
            this.tftpflash(function(err) {
                this.flash_callback(err, cb);
            }.bind(this));
        } else if(this.opts.web) {
            this.webflash(function(err) {
                this.flash_callback(err, cb);
            }.bind(this));
        } else {
            this.webflash(function(err) {
                if(err) {
                    this.nice_error(err);
                    this.tftpflash(function(err) {
                        this.flash_callback(err, cb);
                    }.bind(this));
                }
            }.bind(this))
        }
    };
    
    this.nice_error = function(err) {
        if(err.code == 'ETIMEDOUT') {
            console.error("Connection timed out");
        } else if(err.code == 'EHOSTUNREACH') {
            console.error("Host unreachable");
        } else if(err.code == 'ECONNREFUSED') {
            console.error("Connection refused");
        } else {
            console.error(err);
        }
    };

    this.flash_callback = function(err, cb) {
        if(err) {
            this.nice_error(err);
            if(this.opts.retryonfail) {
                var seconds = parseInt(this.opts.retryonfail);
                seconds = (seconds >= 0) ? seconds : 5;
                console.log("Could not connect. Retrying in " + seconds + " seconds.");
                setTimeout(function() {
                    console.log("Retrying.");                    
                    this.flash();
                }.bind(this), seconds * 1000);
                return;
            }
            cb(err);
            return;
        }

        console.log("Firmware flashing begun!");
        console.log("The firmware has been successfully sent to the router.");
        console.log("In a few seconds, the router should begin flashing its four status LEDs sweeping from left to right, then right to left (or up down, down up).");
        console.log("This means that the router is flashing itself with the new firmware.");
        console.log("Once the router goes back to having only the power LED lit, the router has been successfully flashed.");
        
        if(this.opts.retryonsuccess) {
            var seconds = parseInt(this.opts.retryonsuccess);
            seconds = (seconds >= 0) ? seconds : 20;
            console.log("Will wait "+seconds+" before attempting to flash another edvice.");
            setTimeout(function() {
                console.log("Retrying.");                    
                this.flash();
            }.bind(this), seconds * 1000);
            return;
        }
        cb(null);
    };

    this.checkNetworkConfig = function() {
        if(!os.networkInterfaces) {
            console.log("Remember to give you ethernet interface a static IP in the range 192.168.1.x (and not "+this.opts.ip+") and ensure that no other network interfaces have an IP in the same range (hint: Turn off your wifi to be sure).");
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
                
                if(addr.address == this.opts.ip) {
                    console.error("Error: Your network adapater "+iface+" has the same IP as the router ("+this.opts.ip+"). Flashing is not possible. Aborting.");
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
                if(block.contains(this.opts.ip)) {
                    found += 1;
                    break;
                }
            }
        }
        
        if(found == 0) {
            console.error("========= WARNING =========");
            console.error("It looks like you don't have any network interfaces configured with an IP on the same subnet as the router you are trying to flash ("+this.opts.ip+"). Flashing is likely to fail. Consult the README if you are confused. Proceeding anyway in case you know what you are doing.");
            console.error('');
        } else if(found > 1) {
            console.error("========= WARNING =========");
            console.error("It looks like you have more than one network interfaces configured with an IP on the same subnet as the router you are trying to flash ("+this.opts.ip+"). Flashing is likely to fail. Consult the README if you are confused. Proceeding anyway in case you know what you are doing.");
            console.error('');
        }
        
        return true;
    };
}

module.exports = UbiFlasher;
