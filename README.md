# Laser Api

[Developer Documentation](LASER_API.md)

[Actual frontend usage](FRONTEND.md)

## summary

Idea is to use laser pointers as input, for that this api provides an output raster that is configured with a laser color and provides information if laser is pointing to that direction.

for that simple recording of output using a video stream and a easy texture transform to map the area of interest.

## Demo

master deoployment
https://laser.froso.de/

development deployment
https://laser-dev.froso.de/

## License

Licensed under MIT

### Snapshot of Setup

This playfield is controlled via the red laser dot you see in the next image, the turkis area is what the api provides to the LaserApi application interface, as often as possible :)

![snapshot-playfield](misc/snapshot-playfield.png "Logo Title Text 1")

here you see the raw video/webcam input the marked ared with the "X" is what is scanned for desired color and then filtered out and normalized to above grid playfield input

![snapshot-video](misc/snapshot-video.png "Logo Title Text 1")

Copyright (c) 2017 [Christian Kleinhuis](https://github.com/alexanderthurn) [Alexander Thurn](https://github.com/alexanderthurn)


# Implement Custom Laser Application

The planned interface is to provide a 1dimensional quadratic array of input scanlines. This input is used in various ways, but is meant for pixel counting,
each found laser is represented with a value above 0. Each laser-application implements the following interfaces:

## Interface Laser-Api Application

The interface for a laser application provides a name field, an init() method and a handle(grid) method. The grid is the quadratic array of scanline area, use sqrt() square root to retrieve width/height of grid. 

The interface looks like this:

        {
            name: String,
            init: function()
            handle: function (grid:array) 
        }

## UI Helpers

The filtering of the input grid/array is application dependant, right now some user
interface components can be used to create a simple gui. Each component has to be included in the handle() of its using component and produces event callbacks to be 
reacted upon.

### UI components

User interface components build up upon the above described api and implement components to be used inside your own programs. 

they all implement the same interface and hence the methods forward to the component implementation instance to be used (<-- this means call the handle() method inside your own handle() method for each component instance). 
#### UI FillButton

The fill button works given a start and active range and needs to be filled for triggering an event. By filling is meant a certain time of laser action detected inside its area.

    {
            label = "Sample Button",
            posX,
            posY,
            radius = 10,
            speedUp = 1,
            speedDown = 0.1,
            activeColor = "#ffff00",
            growColor = "#00ffff",
            normalColor = "#008844",
            activeValue = 75,
            onEnterActive,
            onExitActive,
            minValue = 25,
    }

#### UI FlipButton
the flipbutton changes to active as soon as one active 

    {
        label = "Flip Button",
        posX,
        posY,
        radius = 10,
        activeColor = "#ffff00", 
        normalColor = "#008844",
        onEnter,
        onExit,
    }
#### UI RangeSlider
The range slider uses flipButtons to increase or decrease a given value range.

    {
        label = "Range Slider",
        posX,
        posY,
        width = 200,
        height = 50,
        growColor = "#00ffff",
        normalColor = "#0088ff",
        startValue = 0.4,
        minValue = 0.00001,
        maxValue = 1,
        step = 0.1,
        exponential = false,
    }

posX,posY - the topleft corner of the component in canvasSpace
width,height - dimension of the component slider, horizontal, width determines slider size


##### Exponential Parameter

this is my most beloved feature and is inspired by Ultrafractal which provides an exponential smooting since ages. The author managed at some point in time to understand and extract this exponential smoothing function. What it does for parameters that grow exponential by nature, e.g. the zoom level of a 2dimensional plane to accomodate for a regular growth of the area when chaqnging such a parameter.


### Ui Sample Example Usage

Here is an example of how to use an ui component in your own custom laser-application. It implements it using a javascript array with one element andand calls the handle() method using the js array forEach() method:

    import FillButton from './gui/flipbButton'

    const guiComponents=[
         FillButton({label:demo,posX:100,posy:100,radius:100,onFillEnter:()=>{
             console.log('Button has been filled')
         }})
    ]

    export default {
        name:'example app',
        init:()=>{},
        handle:(grid)=>{
            guiComponents.forEach(component=>component.handle(grid))
        }
    }

# Implemented applications

## Laser-Pong
## Laser-Montagsmaler

This reference application implements a painting like space.                                                                          
## Laser-mandelbrot

This reference implementation uses all input components to implement a Mandelbrot Set explorer controlled by laser pointers.