This is a work in progress. See the 'limitations' section.

This is an automated firmware flasher for ubiquiti devices.

It flashes a new firmware using the built-in web interface.

Known problems
--------------

Currently there is a bug in the request library that causes the content-length to not be automatically calculated for multi-part posts. Use the fork of request at https://github.com/juul/request for now.

Setup
-----

Install dependencies:

```
npm install
```
Install patched version of request library:

```
./get_patched_request
```

Usage
-----

Ensure you're connected to your node via ethernet, and that you have an IP in the 192.168.1.x range. This script expects your node to have factory default settings, but should work for any reasonably sane settings assuming you supply username, password and ip if they have been altered.

Examples
--------

Simple example, for a router with default ip, username and password:

```
./flasher.js --firmware myfirmware.bin
```

All supported command line options:

```
./flasher.js --user foo --pass bar --ip 10.0.0.1 --firmware myfirmware.bin
```

Limitations 
-----------

So far only tested with a Ubiquiti Picostation 2 HP.

It seems that at least the Picostation 2 HP does not accept firmware images larger than 4 MB via the web upload procedure, even though it has 8 MB of flash.

If node has never been configured, it configures to english language and United States for country. This is not a problem if you're flashing e.g. OpenWRT, since that will override these settings.

Could use some more descriptive error messages. Especially with regards to wrong username, password or ip.

License: GPLv3
