This is an automated firmware flasher for Ubiquiti AirMax devices.

It flashes a new firmware onto these devices using their built-in web interface or tftp.

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
./flasher.js --user foo --pass bar --ip 10.0.0.1 --firmware myfirmware.bin --retryonfail 5 --retryonsuccess 20 --debug
```

The "--retryonfail 5" argument causes the flasher to retry every five seconds after failing to flash, no matter the type of failure, until it succeeds in flashing one device. When one device has been successfully flashed, the flasher will exit, unless "--retryonsuccess" has been specified.

The "--retryonsuccess 20" argument causes the flasher to begin flashing again after waiting 20 seconds after a successful flash. This is useful for flashing multiple nodes without having to restart the flasher program.

Auto-selecting the correct firmware:

```
./flasher.js --firmware openwrt/attitude_adjustment/12.09/ar71xx/generic/
```

The above command expects a directory full of the various firmware files for the ar71xx like the one [here](http://downloads.openwrt.org/attitude_adjustment/12.09/ar71xx/generic/). It will attempt to auto-detect the model of router by inspecting the <title> tag on the index.cgi page of the router's web admin interface and look for the correct firmware file for the model in the supplied directory. Currently it will probably work with routers of the following types: Rocket M, Nanobridge M, Nanostation M, Bullet M, Unifi and Unifi Outdoor. Not all of those are tested and it will most definitely not work with any other models without tweaking the select_firmware function in flasher.js.

# Setting up a flashing server #

If you want a server with an ethernet plug that will flash any devices that get connected with your firmware of choice, then you can use the initscript:

```
sudo cp initscript /etc/init.d/ubiflasher
```

Edit the UBIFLASHERPATH and FIRMWARE variables in the script to suit your needs. Then do:

```
sudo chmod 755 /etc/init.d/ubiflasher
sudo update-rc.d ubiflasher defaults
sudo /etc/init.d/ubiflasher start
```
Now the flasher is running, will start automatically on boot, and will flash any connected routers.

Remember to set at least one interface on the server to have a static IP in the range 192.168.1.x and _not_ 192.168.1.20.

## Overlapping subnets ##

If you for some reason must run the flasher on a computer that already has another network interface on a 192.168.1.x network, then you can use the following workaround:

Assuming you have an existing network interface eth0 on a 192.168.1.x network and you want to run ubi-flasher on eth1, then ensure that eth0 is not managed by any fancy automation (like network-manager or ifplugd) and run:

```
sudo ifconfig eth1 down
sudo ip addr add 192.168.1.254 dev eth1
sudo ifconfig eth1 up
sudo ip route add 192.168.1.20 dev eth1 metric 1
sudo ip route add 192.168.1.254 dev eth1 metric 1
```

You probably want to add these commands to the "start()" function in the init script, so they are run on start-up, though take out the "sudo" part before you do.

You may also need to add the line "metric 10" to /etc/network/interfaces in the section for eth0 and run:

```
ifdown eth0 && ifup eth0
```

After setting this up, your server will no longer be able to access 192.168.1.20 nor 192.168.1.254 on the network connected to eth0, nor will computers on those IPs be able to communicate with your server.

# Limitations #

So far, this program has only tested with a Ubiquiti Picostation 2 HP and a Ubiquiti Rocket M5.

It seems that the Picostation 2 HP does not accept firmware images larger than 4 MB via the web upload procedure, even though it has 8 MB of flash. This is likely the case with all of the previous generation (802.11g) Ubiquiti AirMax gear. This is not an issue on the newer generation (802.11n) gear. You can still flash the older Ubiquiti gear with > 4 MB images using tftp, but this program does not support tftp.

If the AirMax device has never been configured, then the flasher configures it to English for language and United States for country. This is not a problem if you're flashing e.g. OpenWRT, since that will override these settings.

# Known issues #

Currently there is a bug in the request library that causes the content-length to not be automatically calculated for multi-part posts. For this reason, ubiquiti-flasher is using [a patched version](https://github.com/juul/request) of request from for now.

# ToDo #

Could use some more descriptive error messages. Especially with regards to wrong username, password or ip.

More testing would be nice.

# License, Copyright and Trademarks #

This software is licensed under the GPLv3. Copyright 2014 Marc Juul.

Ubiquiti, AirMax, Picostation, Rocket M, Nanobridge M, Nanostation M, Bullet M, Unifi and Unifi Outdoor are registered trademarks of Ubiquiti Networks, Inc. Neither this program, nor its author, have any affiliation with Ubiquiti Networks, Inc.

# Appreciation #

If you appreciate this program, then you can [tip me with recurring micro-donations on GitTip](https://www.gittip.com/juul/), or [tip me with one-off donations on Flattr](https://flattr.com/profile/juul). This helps me spend all of my time making useful free and open source things :)