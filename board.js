
class Board {
    
    constructor() {
        self.brd =  [
            ["rock", "air", "rock"],
            ["rock", "air", "air"],
            ["rock", "air", "bug"]
        ]

    }

    getObjectAt(x,y) {
        if (y < 0 || y >= self.brd.length || x < 0 || x >= self.brd[0].length) {
            return "rock" // Default to "rock" if out of bounds -- it means you're hitting the cave wall
        }
        return self.brd[y][x]
    }

    render() {
        // Populate the <board> element with the board layout
        const boardElement = document.getElementById("board");
        boardElement.innerHTML = ""; // Clear existing content

        const table = document.createElement("table");
        table.className = "board-table";

        for (let y = 0; y < self.brd.length; y++) {
            const row = document.createElement("tr");
            for (let x = 0; x < self.brd[y].length; x++) {
                const cell = document.createElement("td");
                cell.className = "cell";
                cell.id = `cell-${x}-${y}`;
                cell.textContent = self.brd[y][x];
                row.appendChild(cell);
            }
            table.appendChild(row);
        }

        boardElement.appendChild(table);
    }

}