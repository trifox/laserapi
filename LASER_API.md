# Laser Api Application Development


## Short summary

This project is meant as platform for applications using laser pointers as input. This document describes how to fork this project and create own games. Most of the underlying logic and handling will most certainly change, the interface may change and everything may change, nevertheless the current implementation is documented here

## Context LaserConfig

for retrieving information on the current configuration, mainly the canvas to paint on and the grid resolution and playfield scale may be obtained like this:

     var laserConfig = require('LaserApiConfig').default
     
to get the current gridresolution, be aware that for now the presented grid is rectangular

    laserConfig.gridResolution [integer]
    

to get the pixel resolution of the main canvas use:
    
    laserConfig.canvasResolution.width
    laserConfig.canvasResolution.height

## 2d Canvas for paiting

for now brutally obtain the main drawing canvas like this


    
    var MainCanvas = require('MasterCanvas').default

and obtain canvas like so

    MainCanvas.get2dContext()
    
e.g. paint a rectangle, refer to html canvas documentation on how to use it

    MainCanvas.get2dContext().drawRect(0,0,10,10)
    

be aware that you are free to use any kind of display even html div containers may be used, but canvas provides centering and scaling and some more, so its not advised to use another painting path

## LaserApi Application Interface

The following interface makes up the laserapi application

 
#### getName() (string)       

returns the name of the application

#### init(data) (void)

the init(data) is called upon initialisation, perform any required initialisation for your application here.

the incoming parameter 'data' can be used to initialise anything it is a plain js object

#### stop() (void)
 
the stop() method is used to clean up any initialised stuff for the application 
   
    
#### handle(grid) (void)
    
the handle(grid) method is called as soon as a new datagrid has been calculated, refer to above methods to actually draw something response. Inside this function/application you refresh whatever you need for the implementation of your application
 






## License

Licensed under MIT

Copyright (c) 2017 [Christian Kleinhuis](https://github.com/alexanderthurn)   [Alexander Thurn](https://github.com/alexanderthurn)
