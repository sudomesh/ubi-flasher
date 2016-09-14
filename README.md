This is an automated firmware flasher for Ubiquiti AirMax devices though it should be usable for flashing any router that needs a tftp client for flashing.

# Setup #

Install dependencies:

```
npm install
```

# Usage #

Ensure you're connected to your node via ethernet, and that you have an IP in
the 192.168.1.x range (and not 192.168.1.20). This script expects your node to
have factory default settings, but should work for any reasonably sane settings
assuming you supply username, password and ip if they have been altered.

## Examples ##

Simple example, for a router with default ip, username and password:

```
./flasher.js myfirmware.bin
```

All supported command line options:

```
./flasher.js --ip 10.0.0.1 --firmware myfirmware.bin --retry 5 --debug
```

The "--retry 5" argument causes the flasher to retry every five seconds no matter if flashing failed or succeeded.

# Usage as library #

```
var UbiFlasher = require('ubi-flasher');
var flasher = new Ubiflasher();
flasher.flash('firmware_file_path.bin', {
  // you can add more options here
  // the options are the same as for the command line
}, );
```

# Setting up a flashing server #

If you want a server with an ethernet plug that will flash any devices that get
connected with your firmware of choice, then you can use the initscript:

```
sudo cp initscript /etc/init.d/ubiflasher
```

Edit the UBIFLASHERPATH and FIRMWARE variables in the script to suit your needs.
Then do:

```
sudo chmod 755 /etc/init.d/ubiflasher
sudo update-rc.d ubiflasher defaults
sudo /etc/init.d/ubiflasher start
```

Now the flasher is running, will start automatically on boot, and will flash any
connected routers.

Remember to set at least one interface on the server to have a static IP in the
range 192.168.1.x and _not_ 192.168.1.20.

## Overlapping subnets ##

If you for some reason must run the flasher on a computer that already has
another network interface on a 192.168.1.x network, then you can use the
following workaround:

Assuming you have an existing network interface eth0 on a 192.168.1.x network
and you want to run ubi-flasher on eth1, then ensure that eth0 is not managed by
any fancy automation (like network-manager or ifplugd) and run:

```
sudo ifconfig eth1 down
sudo ip addr add 192.168.1.254 dev eth1
sudo ifconfig eth1 up
sudo ip route add 192.168.1.20 dev eth1 metric 1
sudo ip route add 192.168.1.254 dev eth1 metric 1
```

You probably want to add these commands to the "start()" function in the init
script, so they are run on start-up, though take out the "sudo" part before you
do.

You may also need to add the line "metric 10" to /etc/network/interfaces in the
section for eth0 and run:

```
ifdown eth0 && ifup eth0
```

After setting this up, your server will no longer be able to access 192.168.1.20
nor 192.168.1.254 on the network connected to eth0, nor will computers on those
IPs be able to communicate with your server.

# License, Copyright and Trademarks #

This software is licensed under the GPLv3. Copyright 2014, 2016 Marc Juul.

Ubiquiti, AirMax, Picostation, Rocket M, Nanobridge M, Nanostation M, Bullet M,
Unifi and Unifi Outdoor are registered trademarks of Ubiquiti Networks, Inc.
Neither this program, nor its author, have any affiliation with Ubiquiti
Networks, Inc.

# Appreciation #

If you appreciate this program, then you can
[tip me with recurring micro-donations on GitTip](https://www.gittip.com/juul/),
or [tip me with one-off donations on Flattr](https://flattr.com/profile/juul).
This helps me spend all of my time making useful free and open source things :)
