const { ipcRenderer } = require('electron');

let game;

ipcRenderer.on('asynchronous-message', async function (evt, message) {
    //console.log('received from main: ',message);
    if (message.type == 'setGame') {
        if (message.game == 'breakout') game = new Breakout();
    }
    if (message.type == 'wsData' && message.data.status == 'IR data') {
        //if (game == undefined) game = new Breakout();
        game.updatePoints(message.data);
    }
});

function scaleIRinput(coords){
    if (coords.x < 0) coords.x = 0;
    if (coords.x > 4095) coords.x = 4095;
    if (coords.y < 0) coords.y = 0;
    if (coords.y > 4095) coords.y = 4095;
  
    //Calculate the amount of pixels that are visible on the screen
    const horVisible = screen.width;
    const vertVisible = screen.height;
  
    //Calculate the scaled coordinates
    const posX = (coords.x/4096)*horVisible;
    const posY = (coords.y/4096)*vertVisible;
  
    //Return the value
    return {"x":Math.round(posX),"y":Math.round(posY)};
  }


class Breakout {
    name = 'breakout';
    
    paddle = {
        x: 500,
        y: 500,
        width: 150,
        height: 25,
        bounds: {
            x0: 0,
            x1: 0,
            y0: 0,
            y1: 0 
        }
    }
    stage;
    stageCtx;
    interval;
    started = false;
    ball = {
        dir: {
            x: 0,
            y: 1
        },
        speed: 2,
        maxSpeed: 2,
        x: 500,
        y: 500,
        size: 10
    }
    blocks = [];
    blockData = {
        rowColors: ['#FF0000','#FF7F00','#7FFF00','#00FF00','#00FF7F','#007FFF', '#0000FF'],
        rows: 7,
        columns: 10,
        width: 100,
        height: 25,
        spacing: 5
    }

    constructor() {
        this.renderStart();
    }

    renderStart() {
        let canvas = document.getElementById('canvas');
        canvas.width = window.innerWidth
        canvas.height = window.innerHeight

        this.stage = document.getElementById('canvas')
        if(this.stage.getContext) {
            this.stageCtx = this.stage.getContext('2d');
        }
        this.paddle.y = this.stage.height*0.8;
        this.ball.y = this.stage.height*0.5;
        this.ball.x = this.stage.width*0.5;

        for (let row = 0; row < this.blockData.rows; row++) {
            let rowArray = [];
            const y0 = this.blockData.spacing + row*(this.blockData.spacing+this.blockData.height);
            for (let column = 0; column <= this.blockData.columns; column++) {
                const x0 = this.blockData.spacing + column*(this.blockData.spacing+this.blockData.width);
                rowArray.push({
                    color: this.blockData.rowColors[row],
                    x0,
                    x1: x0 + this.blockData.width,
                    y0,
                    y1: y0 + this.blockData.height,
                    hit: false
                })
            }
            this.blocks.push(rowArray);
        }

        this.interval = setInterval(() => {
            this.drawCanvas();
        },1);
    }

    isWithinBounds(coordinates, size, bounds) {
        if (coordinates.y + size < bounds.y0 || coordinates.y - size > bounds.y1) return false;
        if (coordinates.x + size < bounds.x0 || coordinates.x- size > bounds.x1) return false;
        return (coordinates.x - bounds.x0) / (bounds.x1 - bounds.x0);
    }

    drawCanvas() {
        this.stageCtx.clearRect(0, 0, this.stage.width, this.stage.height);

        if (this.started) {
            this.ball.x += this.ball.dir.x * this.ball.speed;
            this.ball.y += this.ball.dir.y * this.ball.speed;

            //if ball is hitting sides
            if (this.ball.y - this.ball.size <= 0) this.ball.dir.y = -this.ball.dir.y;
            if (this.ball.x - this.ball.size <= 0) this.ball.dir.x = -this.ball.dir.x;
            if (this.ball.x + this.ball.size >= this.stage.width) this.ball.dir.x = -this.ball.dir.x;
            

            //if ball is in vertical space of paddle
            let dir = this.isWithinBounds({x: this.ball.x, y:this.ball.y}, this.ball.size, this.paddle.bounds)
            if (dir) {
                this.ball.dir = {
                    x: dir-0.5,
                    y: -this.ball.dir.y
                }
                this.ball.speed += 0.05;
                if (this.ball.speed >= this.ball.maxSpeed) this.ball.speed = this.ball.maxSpeed;
            }
            
            //if ball is in space of blocks
            const rows = this.blocks.filter(r => r[0].y1 >= this.ball.y-this.ball.size && r[0].y0 < this.ball.y+this.ball.size)
            for (let row of rows) {
                const blocks = row.filter(b => b.x0 < this.ball.x+this.ball.size && b.x1 > this.ball.x-this.ball.size);
                for (let block of blocks) {
                    if (block.hit) continue;
                    block.hit = true;

                    //how far horizontally and vertically
                    const hor = (this.ball.x + this.ball.size - block.x0) / (block.x1 - block.x0);
                    const vert = (this.ball.y - this.ball.size - block.y0) / (block.y1 - block.y0);

                    if (vert > -0.85 && vert < 0.85) this.ball.dir.x = -this.ball.dir.x;
                    else this.ball.dir.y = -this.ball.dir.y;
                    break;
                }
            }
        }

        //draw paddle
        this.stageCtx.fillStyle = '#777777';
        this.stageCtx.fillRect(this.paddle.x,this.paddle.y,this.paddle.width,this.paddle.height);
        this.stageCtx.fill();
        this.paddle.bounds = {
            x0: this.paddle.x,
            x1: this.paddle.x + this.paddle.width,
            y0: this.paddle.y,
            y1: this.paddle.y + this.paddle.height
        }

        //draw ball
        this.stageCtx.fillStyle = '#000000';
        this.stageCtx.beginPath();
        this.stageCtx.arc(this.ball.x,this.ball.y,this.ball.size,0,2*Math.PI,false);
        this.stageCtx.fill();

        //draw blocks
        for (let row of this.blocks) {
            for (let block of row) {
                if (block.hit) continue;
                this.stageCtx.fillStyle = block.color;
                this.stageCtx.fillRect(block.x0, block.y0, this.blockData.width, this.blockData.height);
                this.stageCtx.fill();
            }
        }
    }

    updatePoints(data) {
        let point = data.irPoints[0];
        const coords = {x: point.x, y: point.y}
        if (coords.x == 0 && coords.y == 0) return;
        if (coords.x == -9999 || coords.y == -999) return;
        const x = point.x/4096*this.stage.width;
        this.paddle.x = x-this.paddle.width/2;
        this.started = true;
    }
}