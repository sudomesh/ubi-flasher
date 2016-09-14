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
var tftp = require('tftp');
var Netmask = require('netmask').Netmask;


function UbiFlasher() {

    this.opts = null;

    this.debug = function(str, opts) {
        if(this.opts && this.opts.debug) {
            console.log("[DEBUG]: " + str);
        }
    };

    this.tftpflash = function(callback) {
        fs.stat(this.opts.firmware, function(err, stats) {
            if(err) return callback(err);
            
            if(stats.isDirectory()) {
                console.error("You specify a file, not a directory.")
                return callback(err);
            }
            
            
            var client = tftp.createClient({
                host: this.opts.ip
            });
            
            console.log("Sending "+ this.opts.firmware + " to " + this.opts.ip + " using tftp put");
  
            fs.stat(this.opts.firmware, function(err, stats) {
                if(err) {
                    return fallback(err);
                }
            });
            this.firmwareStream = fs.createReadStream(this.opts.firmware);

            // TODO switch to client.createPutStream
            client.put(this.opts.firmware, function(error) {
                if(error) {
                    return callback(error);
                }
                callback(null);
            }.bind(this));

        }.bind(this));
    };


    this.flash = function(firmware, opts, cb) {
        if(typeof firmware === 'object') {
            cb = opts;
            opts = firmware;
        }
        if(typeof opts === 'function') {
            cb = opts;
        }

        this.opts = this.opts || opts || {};

        this.opts.firmware = this.opts.firmware || firmware;
        this.opts.ip = this.opts.ip || '192.168.1.20';
        
        
        cb = cb || function() {};
        if(!this.checkNetworkConfig()) {
            return;
        };


        this.tftpflash(function(err) {
            this.flash_callback(err, function(err, cb) {
                if(cb) cb(err);
            });
        }.bind(this));
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

    this.retry = function() {
        var seconds = parseInt(this.opts.retry);
        seconds = (seconds >= 0) ? seconds : 5;
        console.log("Retrying in " + seconds + " seconds.");
        setTimeout(function() {
            console.log("Retrying.");                    
            this.flash();
        }.bind(this), seconds * 1000);
        return;
    };

    this.flash_callback = function(err, cb) {
        if(err) {
            this.nice_error(err);
            if(this.opts.retry) this.retry();
            cb(err);
            return;
        }

        console.log("Firmware flashing begun!");
        console.log("The firmware has been successfully sent to the router.");
        console.log("In a few seconds, the router should begin flashing its four status LEDs sweeping from left to right, then right to left (or up down, down up).");
        console.log("This means that the router is flashing itself with the new firmware.");
        console.log("Once the router goes back to having only the power LED lit, the router has been successfully flashed.");
        
        if(this.opts.retry) this.retry();
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
