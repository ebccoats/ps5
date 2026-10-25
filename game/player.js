class Player {
  
  constructor(board) {
    this.x = 2
    this.y = 2
    this.orientation = [0,1]
    this.velocity = 0.005
    this.board = board
    this.isFrozen = false
  }

  // ------------------------------------------------------------------
  // Movement
  // ------------------------------------------------------------------

  getOrientation() {
    return this.orientation
  }

  changeOrientation(camera_x, camera_y) {
    let [x,y] = [ Math.ceil(camera_x - this.getX()), Math.ceil(camera_y - this.getY())]
    // this.orientation = [x,y]
    // don't change orientation if it is 0, keep it at last orientation
    if (!(x==0 && y==0)) {
      this.orientation = [x,y]
    }
    
}

  move(board, velocity=this.velocity) {

    if (this.isFrozen) return;

    this.x = Math.max(this.x + velocity*this.orientation[0], 0)
    this.y = Math.max(this.y + velocity*this.orientation[1], 0)

    if (board.isNearlyOutOfBounds(this.x, this.y)) {
      board.generateMoreBoard()
    }

    if (board.getObjectAt(...this.getLocation()) === "rock") {
      this.bumpIntoRock()
      
    }
    else if (board.getObjectAt(...this.getLocation()) === "bug") {
      this.eatBug()
    }

    draw()
  }

  freeze(time) {
    this.isFrozen = true
    setTimeout(this.unfreeze, time)
  }

  unfreeze() {
    this.isFrozen = false
  }

  // ------------------------------------------------------------------
  // Taking actions (eating bugs or bumping into rocks)
  // ------------------------------------------------------------------

  getDistanceFromObject(x,y) {
    return (Math.hypot(this.x - x, this.y - y) - 0.5) // subtract the radius of the object
  }

  eatBug() {
    board.changeObjectAt(...this.getLocation(), "air")
    switchMode("munchBug")
    pauseModeSwitches(400)
  }

  bumpIntoRock() {
    // The player shouldn't be able to enter this space.
    switchMode("slamRock")
    pauseModeSwitches(400)

    this.move(board, -20*this.velocity)
    // this.freeze(1000)
  }

  // ------------------------------------------------------------------
  // Getting Locations
  // ------------------------------------------------------------------

  getLocation() {
    return [Math.round(this.x), Math.round(this.y)]
  }

  getX() {
    return this.getLocation()[0]
  }

  getY() {
    return this.getLocation()[1]
  }

  getPreciseLocation() {
    return [this.x, this.y]
  }

  getPreciseX() {
    return this.getPreciseLocation()[0]
  }

  getPreciseY() {
    return this.getPreciseLocation()[1]
  }
}