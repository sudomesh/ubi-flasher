This is an automated firmware flasher for Ubiquiti AirMax devices.

It flashes a new firmware onto these devices using their built-in web interface.

Ubiquiti, AirMax, Picostation and Rocket M5 are registered trademarks of Ubiquiti Networks, Inc. Neither this program, nor its author, have any affiliation with Ubiquiti Networks, Inc.

# Setup #

Install dependencies:

```
npm install
```

# Usage #

Ensure you're connected to your node via ethernet, and that you have an IP in the 192.168.1.x range (and not 192.168.1.20). This script expects your node to have factory default settings, but should work for any reasonably sane settings assuming you supply username, password and ip if they have been altered.

## Examples ##

Simple example, for a router with default ip, username and password:

```
./flasher.js --firmware myfirmware.bin
```

All supported command line options:

```
./flasher.js --user foo --pass bar --ip 10.0.0.1 --firmware myfirmware.bin
```

Simple example, with debug output enabled:

```
./flasher.js --firmware myfirmware.bin --debug
```

# Limitations #

So far this program has only tested with a Ubiquiti Picostation 2 HP and Ubiquiti Rocket M5.

It seems that the Picostation 2 HP does not accept firmware images larger than 4 MB via the web upload procedure, even though it has 8 MB of flash. This is likely the case with all of the previous generation (802.11g) Ubiquiti AirMax gear. This is not an issue on the newer generation (802.11n) gear.

If node has never been configured, it configures to english language and United States for country. This is not a problem if you're flashing e.g. OpenWRT, since that will override these settings.

Known issues
--------------

Currently there is a bug in the request library that causes the content-length to not be automatically calculated for multi-part posts. For this reason, ubiquiti-flasher is using [a patched version](https://github.com/juul/request) of request from for now.


ToDo
----

Could use some more descriptive error messages. Especially with regards to wrong username, password or ip.

More testing would be nice.

License
-------

GPLv3