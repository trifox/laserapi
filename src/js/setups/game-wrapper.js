const defaultImage = new Image(100, 100)
class GameWapper {
  constructor(gameIn) {
    this.game = gameIn;

    this.updateImage()
  }
  updateImage() {
    if (this.game.image) {
      this.image = new Image(100, 100)

      const regext = /###(\d)###/
      var image = this.game.image
      console.log('regexp is', regext)
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
    // console.log("this is ", this);
    if (this.game.getDescription) {
      return this.game.getDescription();
    }

    if (this.game.description) {
      return this.game.description;
    }

    return "defaultDescription";
  }
  getImage() {

    return this.image.complete ? this.image : defaultImage
  }

  init(data) {
    if (this.game.init) {
      this.game.init(data);
    }
    this.updateImage()
  }

  stop() {
    if (this.game.stop) {
      this.game.stop();
    }
  }

  handle(grid, elapsed) {
    if (this.game.handle) {
      this.game.handle(grid, elapsed);
    }
  }
}

export default GameWapper;
