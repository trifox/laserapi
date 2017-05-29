# Laser Api Frontend (state of the art)

this is current frontend roundup documentation

## selectboxes
### presets

choose from hard coded presets taken from LaserApiPresets.js

### game

actual application

## Sliders

### scalePlayfield

visible scale of playfield used to correct dead angles and otherwise for the camera invisible parts

### lasercolor

what is considered the laser color

### treshold

allowed tolerance for being considered as valid after doing vector distance of current to lasercolor

### gridresolution

internal grid resolution, really because to just have one slider for thisa its rectangular
       
### checkboxes

#### debugVideo
show input video and filtered for valid color
#### showGame
shows current application
#### showDebug

shows internal raster
       
### topleftx
guesswhat
### toplefty
guesswhat
### toprightx
guesswhat
### toprighty
### bottomleftx
guesswhat
### bottomlefty
guesswhat
### bottomrightx

guesswhat
### bottomrighty

guesswhat

## Keyboard shortcuts

### f

goes fullscreen of main raster

### SHIFT-f

goes fullscreen with all input controls accessible 

    HINT: ONLY IN THIS MODE THE CONFIGURATION CAN BE DONE!

### 0...9

loads hard coded preset

### d - debug raster

shows the internal result raster

### g - game 

shows the actual application


### v - show input video and filtered by lasercolor

### s - creates canvas and video snapshots in html

## License

Licensed under MIT

Copyright (c) 2017 [Christian Kleinhuis](https://github.com/alexanderthurn)   [Alexander Thurn](https://github.com/alexanderthurn)
