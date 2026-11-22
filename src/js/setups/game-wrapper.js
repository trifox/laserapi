/**
 * this file defines the interface for the game, and is implemented as always wrapped, 
 * so each method is forwarded to the assigned game in constructor
 * 
 * this wrapper servers as a stabilisiation layer between game engine and implemented games
 * 
 * new methods are added here, and then can be implemented in sub games, for now it served alreadz
 * various extensions that will be listed here>
 * 
 * - started with that ultimate handle() methode
 * - added init/stop methods
 * - added name and description properties and getter methods
 * - added image property, handling preview/title image generation with basic numbering syntax
 * - added helpText property, the games got more complex especially with ai, so more infos here
 * 
 */

// for now, no imports


const defaultImage = new Image(100, 100)
class GameWapper {
  constructor(gameIn) {
    // constructor gets the wrapped game, every game should be wrapped by this container wrap GameWrapper
    this.game = gameIn;

    this.updateImage()
  }

  updateImage() {
    // creates a new preview game image file name, respecting the syntax presented in filename of game impl
    if (this.game.image) {
      // game has defined an image
      this.image = new Image(100, 100)

      // hehe simple regexp number parsing allowing for multiple varying intro images
      const regext = /###(\d)###/
      var image = this.game.image
     // console.log('regexp is', regext)
      const regexpresult = regext.exec(image)
      if (regexpresult) {
        console.log(regexpresult)
        image = image.replace(regexpresult[0], 2 + Math.floor(Math.random() * Number(regexpresult[1])))
      }

      this.image.src = image
    } else {
      this.image = defaultImage
    }

  }
  getName() {
    // returns the given name of the game using method or property...
    //console.log("this is ", this);
    if (this.game.getName) {
      return this.game.getName();
    }

    if (this.game.name) {
      return this.game.name;
    }

    return "defaultName";
  }

  getDescription() {
    // returns a string of description to be displayed as game description general
    // console.log("this is ", this);
    if (this.game.getDescription) {
      return this.game.getDescription();
    }

    if (this.game.description) {
      return this.game.description;
    }

    return "defaultDescription";
  }

  getHelp() {
    // returns a string of helptext to be displayed as game help description detailed
    // console.log("this is ", this);

    if (this.game.getHelp) {
      return this.game.getHelp();
    }

    if (this.game.helpText) {
      return this.game.helpText;
    }

    return "defaultHelpText";
  }


  getImage() {
    // returns the image of the game to be displayed when game changes
    return this.image.complete ? this.image : defaultImage
  }

  init(data) {
    // calls the init method if present
    if (this.game.init) {
      this.game.init(data);
    }
    this.updateImage()
  }

  stop() {
    // calls the stop method if present
    if (this.game.stop) {
      this.game.stop();
    }
  }

  handle(grid, elapsed) {
    // calls the handle method - the most crucial method - if present
    if (this.game.handle) {
      this.game.handle(grid, elapsed);
    }

    // tbd> fallback?
  }
}

export default GameWapper;
