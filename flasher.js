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

var argv = require('optimist').argv;
var UbiFlasher = require('./index.js');

// hack based on:
// https://github.com/mikeal/request/issues/418
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

argv.username = argv.username || argv.user || 'ubnt';
argv.password = argv.password || argv.pass || 'ubnt';

argv.ip = argv.ip || '192.168.1.20';

argv.host = 'http://'+argv.ip;

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

var flasher = new UbiFlasher();

flasher.flash(argv);
