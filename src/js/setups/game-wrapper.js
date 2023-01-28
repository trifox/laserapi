class GameWapper {
  constructor(gameIn) {
    this.game = gameIn;
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

    return "defaultName";
  }

  init(data) {
    if (this.game.init) {
      this.game.init(data);
    }
  }

  stop() {
    if (this.game.stop) {
      this.game.stop();
    }
  }

  handle(grid,elapsed) {
    if (this.game.handle) {
      this.game.handle(grid,elapsed);
    }
  }
}

export default GameWapper;
