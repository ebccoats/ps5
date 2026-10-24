class Player {

  constructor() {
    self.x = 1
    self.y = 1
  }

  updateLocation(x,y) {
    self.x = x
    self.y = y
  }

  getLocation() {
    return [self.x, self.y]
  }

  renderOn(board) {
    // Get the TD element at the right row and column
    document.getElementById(`cell-${self.x}-${self.y}`).textContent = "YOU ARE HERE"
  }
}