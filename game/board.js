
class Board {
    
    constructor(player) {
        this.width = 400
        this.height = 400

        this.player = player

        this.brd =  [
            ["rock", "air", "rock", "air", "air"],
            ["rock", "air", "air", "air", "air"],
            ["rock", "rock", "air", "bug", "air"],
            ["rock", "air", "bug", "bug", "air"],
            ["rock", "air", "bug", "bug", "air"]        
        ]

        // Percentage chance of running into any of these
        this.rock_occs = 0.2
        this.bug_occs = 0.1
        this.air_occs = 0.7

    }

    getSize() {
        return this.brd.length
    }

    getXMax() {
        return this.brd[0].length - 1
    }

    getYMax() {
        return this.brd.length - 1
    }

    isOutOfBounds(x,y) {
        return (y < 0 || y >= this.brd.length || x < 0 || x >= this.brd[0].length)
    }

    // True if the player is within 2 units of the y length or x length
    isNearlyOutOfBounds(x,y) {
        return (y >= this.brd.length - 2 || x >= this.brd[0].length - 2)
    }

    // Generate more board 
    generateMoreBoard() {
        const oldHeight = this.brd.length;
        const oldWidth = this.brd[0].length;

        const targetHeight = oldHeight + 10;
        const targetWidth = oldWidth + 10;

        const generateTile = () => {
            const rand = Math.random();

            if (rand < this.rock_occs) {
                return "rock";
            }

            if (rand < this.rock_occs + this.bug_occs) {
                return "bug";
            }

            return "air";
        };

        // Expand existing rows.
        for (const row of this.brd) {
            while (row.length < targetWidth) {
                row.push(generateTile());
            }
        }

        // Add new rows.
        while (this.brd.length < targetHeight) {
            const row = [];

            while (row.length < targetWidth) {
                row.push(generateTile());
            }

            this.brd.push(row);
        }
    }

    getObjectAt(x,y) {
        if (this.isOutOfBounds(x,y)) {
            return "rock" // Default to "rock" if out of bounds -- it means you're hitting the cave wall
        }
        return this.brd[y][x]
    }

    changeObjectAt(x,y, newObj) {
        if (this.isOutOfBounds(x,y)) {
            throw new Error("The game board is not big enough to change an object at", x, y);
        }

        this.brd[y][x] = newObj
    }

    render() {
        // draw(this, this.player)
    }

}

