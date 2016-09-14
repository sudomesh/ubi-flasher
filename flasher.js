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

var argv = require('minimist')(process.argv.slice(2), {
    boolean: ['tftp', 'web', 'debug']
});
var UbiFlasher = require('./index.js');

argv.firmware = argv.firmware || argv._[0];

if(!argv.firmware) {
    console.log('');
    console.log("Usage: flasher.js <firmware.bin|directory>")
    console.log('');
    console.log(" --ip <ip_address>: Set IP of router (default: 192.168.1.20)");
    console.log('');
    console.log(" --debug: Enable verbose debug output");
    console.log('');
    console.log(" --retryonfail [seconds]: Retry after a failed attempt (default: disabled)");
    console.log("                          Optionally set seconds to wait before retrying.");
    console.log('');
    process.exit(1);
}

var flasher = new UbiFlasher();

flasher.flash(argv);
