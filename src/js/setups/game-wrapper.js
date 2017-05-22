class GameWapper {

    constructor(gameIn) {
        this.game = gameIn

    }

    getName() {
        if (this.game.getName()) {
            return this.game.getName()
        }

        if (this.game.name) {
            return this.game.name
        }

        return 'defaultName'
    }

    init(data) {
        if (this.game.init) {
            this.game.init(data)
        }
    }

    stop() {
        if (this.game.stop) {
            this.game.stop()
        }
    }

    handle(grid) {
        if (this.game.handler) {
            this.game.handler(grid)
        }
    }

}

export default  GameWapper
