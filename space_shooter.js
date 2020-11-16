/* 
------------------------------
------- INPUT SECTION -------- 
------------------------------
*/

/**
 * This class binds key listeners to the window and updates the controller in attached player body.
 * 
 * @typedef InputHandler
 */
class InputHandler {
	key_code_mappings = {
		button: {
			32: { key: 'space', state: 'action_1' }
		},
		axis: {
			68: { key: 'right', state: 'move_x', mod: 1 },
			65: { key: 'left', state: 'move_x', mod: -1 },
			87: { key: 'up', state: 'move_y', mod: -1 },
			83: { key: 'down', state: 'move_y', mod: 1 }
		}
	};
	player = null;

	constructor(player) {
		this.player = player;

		// bind event listeners
		window.addEventListener("keydown", (event) => this.keydown(event), false);
		window.addEventListener("keyup", (event) => this.keyup(event), false);
	}

	/**
	 * This is called every time a keydown event is thrown on the window.
	 * 
	 * @param {Object} event The keydown event
	 */
	keydown(event) {
		this.player.raw_input[event.keyCode] = true;
	}

	/**
	 * This is called every time a keyup event is thrown on the window.
	 * 
	 * @param {Object} event The keyup event
	 */
	keyup(event) {
		delete this.player.raw_input[event.keyCode];
	}

	resetController() {
		// reset all buttons to false
		for (let mapping of Object.values(this.key_code_mappings.button)) {
			this.player.controller[mapping.state] = false;
		}

		// reset all axis to zero
		for (let mapping of Object.values(this.key_code_mappings.axis)) {
			this.player.controller[mapping.state] = 0;
		}
	}

	pollController() {
		this.resetController();

		// poll all bound buttons
		for (let [key_code, mapping] of Object.entries(this.key_code_mappings.button)) {
			if (this.player.raw_input[key_code] === true) {
				this.player.controller[mapping.state] = true;
			}
		}

		// poll all bound axis
		for (let [key_code, mapping] of Object.entries(this.key_code_mappings.axis)) {
			if (this.player.raw_input[key_code] === true) {
				this.player.controller[mapping.state] += mapping.mod;
			}
		}
	}
}

/* 
------------------------------
------- BODY SECTION  -------- 
------------------------------
*/

/**
 * Represents a basic physics body in the world. It has all of the necessary information to be
 * rendered, checked for collision, updated, and removed.
 * 
 * @typedef Body
 */
class Body {
	position = { x: 0, y: 0 };
	velocity = { x: 0, y: 0 };
	size = { width: 10, height: 10 };
	health = 100;

	/**
	 * Creates a new body with all of the default attributes
	 */
	constructor() {
		// generate and assign the next body id
		this.id = running_id++;
		// add to the entity map
		entities[this.id] = this;
	}

	/**
	 * @type {Object} An object with two properties, width and height. The passed width and height
	 * are equal to half ot the width and height of this body.
	 */
	get half_size() {
		return {
			width: this.size.width / 2,
			height: this.size.height / 2
		};
	}

	/**
	 * @returns {Boolean} true if health is less than or equal to zero, false otherwise.
	 */
	isDead() {
		return this.health <= 0;
	}

	/**
	 * Updates the position of this body using the set velocity.
	 * 
	 * @param {Number} delta_time Seconds since last update
	 */
	update(delta_time) {
		// move body
		this.position.x += delta_time * this.velocity.x;
		this.position.y += delta_time * this.velocity.y;
	}

	/**
	 * This function draws a green line in the direction of the body's velocity. The length of this
	 * line is equal to a tenth of the length of the real velocity
	 * 
	 * @param {CanvasRenderingContext2D} graphics The current graphics context.
	 */
	draw(graphics) {
		graphics.strokeStyle = '#00FF00';
		graphics.beginPath();
		graphics.moveTo(this.position.x, this.position.y);
		graphics.lineTo(this.position.x + this.velocity.x / 10, this.position.y + this.velocity.y / 10);
		graphics.stroke();
	}

	/**
	 * Marks this body to be removed at the end of the update loop
	 */
	remove() {
		queued_entities_for_removal.push(this.id);
	}
}

/**
 * Represents an player body. Extends a Body by handling input binding and controller management.
 * 
 * @typedef Player
 */
class Player extends Body {
	// this controller object is updated by the bound input_handler
	controller = {
		move_x: 0,
		move_y: 0,
		action_1: false
	};
	raw_input = {};
	speed = 2;
	input_handler = null;

	/**
	 * Creates a new player with the default attributes.
	 */
	constructor() {
		super();
		//Used as a counter to spawn enemies at consistent times
		this.enemyTimer = 0
		//Used to determine if the player is able to file a projectile
		this.projectileReady = false

		// bind the input handler to this object
		this.input_handler = new InputHandler(this);

		// we always want our new players to be at this location
		this.position = {
			x: config.canvas_size.width / 2,
			y: config.canvas_size.height - 100
		};

		this.color = '#90EE90'
		this.hit = 0
		
		//Gives an array of all enemies and projectiles that are currently
		//on the board
		this.enemies = []
		this.projectiles = []
	}


	/**
	 * Draws the player as a triangle centered on the player's location.
	 * 
	 * @param {CanvasRenderingContext2D} graphics The current graphics context.
	 */
	draw(graphics) {
		graphics.strokeStyle = this.color;
		graphics.beginPath();
		graphics.moveTo(
			this.position.x,
			this.position.y - this.half_size.height
		);
		graphics.lineTo(
			this.position.x + this.half_size.width,
			this.position.y + this.half_size.height
		);
		graphics.lineTo(
			this.position.x - this.half_size.width,
			this.position.y + this.half_size.height
		);
		graphics.lineTo(
			this.position.x,
			this.position.y - this.half_size.height
		);
		graphics.stroke();

		// draw velocity lines
		super.draw(graphics);
	}


	/**
	 * Updates the player given the state of the player's controller.
	 * 
	 * @param {Number} delta_time Time in seconds since last update call.
	 */
	update(delta_time) {
		//Spawns an enemy 
		this.enemyTimer += 1
		if (this.enemyTimer % 20 == 0) {
			enemyCount += 1
			new Enemy()
		}

		//Allows a projectile to fire using the same timer as enemy spawner
		if (this.enemyTimer % 40 == 0 && !this.projectileReady) {
			this.projectileReady = true
		}
		//Fires a projectile
		if (this.controller.action_1 && this.projectileReady) {
			if (masterTime > projShotTime + 0.5) {
				projShotTime = masterTime
				new Projectile()
				this.projectileReady = false	
			}
		}

		//Shows user when player has been hit by flashing red
		if (this.hit != 0 && this.health > 0) {
			this.hit -= 1
			if ((this.hit > 80) || (this.hit > 40 && this.hit < 60) || (this.hit < 20 && this.hit > 2)) {
				this.color = '#FF0000'
			} else {
				this.color = '#90EE90'
			}
		} else {
			this.color = '#90EE90'
		}

		//Determines which way to move the player depending on the
		//input from the user, uses pythagorean theorem to determine
		//the speed for moving diagonal so that it remains consistent
		//with vertical and horizontal speeds
		let diagonalSpeed = Math.sqrt((this.speed * this.speed) / 2)
		if (this.controller.move_x == 1 && this.controller.move_y == -1) {
			this.position.x = this.position.x + diagonalSpeed
			this.position.y = this.position.y - diagonalSpeed
		} else if (this.controller.move_x == -1 && this.controller.move_y == -1) {
			this.position.x = this.position.x - diagonalSpeed
			this.position.y = this.position.y - diagonalSpeed
		} else if (this.controller.move_x == -1 && this.controller.move_y == 1) {
			this.position.x = this.position.x - diagonalSpeed
			this.position.y = this.position.y + diagonalSpeed
		} else if (this.controller.move_x == 1 && this.controller.move_y == 1) {
			this.position.x = this.position.x + diagonalSpeed
			this.position.y = this.position.y + diagonalSpeed
		} else if (this.controller.move_x == -1) {
			this.position.x = this.position.x - this.speed
		} else if (this.controller.move_x == 1) {
			this.position.x = this.position.x + this.speed
		} else if (this.controller.move_y == -1) {
			this.position.y = this.position.y - this.speed
		} else if (this.controller.move_y == 1) {
			this.position.y = this.position.y + this.speed
		}

		// update position
		super.update(delta_time);


		// clip to screen
		this.position.x = Math.min(Math.max(0, this.position.x), config.canvas_size.width);
		this.position.y = Math.min(Math.max(0, this.position.y), config.canvas_size.height);


	}
}

/*
------------------------------
------ PROJECTILE SECTION -------- 
------------------------------
*/
/**
 * Represents a Projectile. Extends a Body with positioning.
 * 
 * @typedef Projectile
 */
class Projectile extends Body {
	speed = 5
	constructor() {
		super();

		this.projectile = {
			x: player.position.x,
			y: player.position.y
		};

	}

	/**
	 * Draws the player as a triangle centered on the player's location.
	 * 
	 * @param {CanvasRenderingContext2D} graphics The current graphics context.
	 */
	draw(graphics) {
		graphics.strokeStyle = '#19dk4d';
		graphics.beginPath();
		graphics.moveTo(
			this.projectile.x,
			this.projectile.y
		);
		graphics.lineTo(
			this.projectile.x,
			this.projectile.y - 10
		);

		graphics.stroke();

		// draw velocity lines
		super.draw(graphics);
	}

	/**
	 * Updates the player given the state of the player's controller.
	 * 
	 * @param {Number} delta_time Time in seconds since last update call.
	 */
	update(delta_time) {
		//Removes all projectiles from board when player dies
		if (player.health == 0) {
			this.remove()
		}

		//Adds projectile to player array
		let x = this.projectile.x
		let y = this.projectile.y
		player.projectiles[this.id] = { x, y }

		//Moves projectile up the board once fired
		this.projectile.y -= this.speed

		//If projectile has left field of view, remove it
		if (this.projectile.y < 0) {
			this.remove()
		}

		//Determines if projectile has hit an enemy
		player.enemies.map((enemy) => {
			if ((this.projectile.x + 8 >= enemy.x && this.projectile.x - 8 <= enemy.x) && (this.projectile.y + 8 >= enemy.y && this.projectile.y - 8 <= enemy.y)) {
				enemiesHit += 1
				this.remove()
			}
		})

		// update position
		super.update(delta_time);


		// clip to screen
		this.projectile.x = Math.min(Math.max(0, this.projectile.x), config.canvas_size.width);
		this.projectile.y = Math.min(Math.max(0, this.projectile.y), config.canvas_size.height);


	}
}



/*
------------------------------
------ ENEMY SECTION -------- 
------------------------------
*/
/**
 * Represents an enemy body. 
 * 
 * @typedef Enemy
 */
class Enemy extends Body {
	speed = 3;

	constructor() {
		super();

		//Gives enemy a random starting point on the board not 
		//near the edges
		this.position = {
			x: Math.floor(Math.random() * 260) + 30,
			y: -50
		};

	}


	/**
	 * Draws the enemy as a triangle
	 * 
	 * @param {CanvasRenderingContext2D} graphics The current graphics context.
	 */
	draw(graphics) {
		graphics.strokeStyle = '#000000';
		graphics.beginPath();
		graphics.moveTo(
			this.position.x,
			this.position.y - this.half_size.height
		);
		graphics.lineTo(
			this.position.x + this.half_size.width,
			this.position.y + this.half_size.height
		);
		graphics.lineTo(
			this.position.x + this.half_size.width * 2,
			this.position.y - this.half_size.height
		);
		graphics.lineTo(
			this.position.x,
			this.position.y - this.half_size.height
		);
		graphics.stroke();

		// draw velocity lines
		super.draw(graphics);
	}


	/**
	 * Updates the player given the state of the player's controller.
	 * 
	 * @param {Number} delta_time Time in seconds since last update call.
	 */


	update(delta_time) {
		//removes enemy if player dies
		if (player.health == 0) {
			this.remove()
		}

		//adds enemy to player array
		let y = this.position.y
		let x = this.position.x
		player.enemies[this.id] = { x, y }

		//bug fix
		if (this.id == 1) {
			this.remove()
		}

		let diagonalSpeed = Math.sqrt((this.speed * this.speed) / 2) * 2
		//Moves enemy down the screen and once close enough, towards player
		if (player.position.y - this.position.y < 150 && player.position.y - this.position.y > 0 && Math.round(this.position.y) % 4 == 0) {
			if (player.position.x > this.position.x) {
				this.position.x = this.position.x + diagonalSpeed / 1.5
				this.position.y = this.position.y + diagonalSpeed / 1.5
			} else {
				this.position.x = this.position.x - diagonalSpeed / 1.5
				this.position.y = this.position.y + diagonalSpeed / 1.5
			}
		}
		else {
			this.position.y = this.position.y + this.speed
		}

		//Removes enemy once it exits view
		if (this.position.y > 500) {
			this.remove()
		}

		//Determins if enemy has been hit by a projectile
		player.projectiles.map((projectile) => {
			if ((this.position.x + 10 >= projectile.x && this.position.x - 10 <= projectile.x) && (this.position.y + 10 >= projectile.y && this.position.y - 10 <= projectile.y)) {
				this.remove()
			}
		})

		//If enemy hits the player, it decreases their health and removes self
		if ((this.position.x + 10 >= player.position.x && this.position.x - 10 <= player.position.x) &&
			(this.position.y + 10 >= player.position.y && this.position.y - 10 <= player.position.y)) {
			player.hit = 100
			player.health -= 25
			this.remove()
		}

		// update position
		super.update(delta_time);


		// clip to screen
		this.position.x = Math.min(Math.max(0, this.position.x), config.canvas_size.width + 50);
		this.position.y = Math.min(Math.max(0, this.position.y), config.canvas_size.height + 50);


	}
}

/* 
------------------------------
------ CONFIG SECTION -------- 
------------------------------
*/

const config = {
	graphics: {
		// set to false if you are not using a high resolution monitor
		is_hi_dpi: true
	},
	canvas_size: {
		width: 360,
		height: 500
	},
	update_rate: {
		fps: 60,
		seconds: null
	}
};

config.update_rate.seconds = 1 / config.update_rate.fps;

// grab the html span
const game_state = document.getElementById('game_state');

// grab the html canvas
const game_canvas = document.getElementById('game_canvas');
game_canvas.style.width = `${config.canvas_size.width}px`;
game_canvas.style.height = `${config.canvas_size.height}px`;

const graphics = game_canvas.getContext('2d');

// for monitors with a higher dpi
if (config.graphics.is_hi_dpi) {
	game_canvas.width = 2 * config.canvas_size.width;
	game_canvas.height = 2 * config.canvas_size.height;
	graphics.scale(2, 2);
} else {
	game_canvas.width = config.canvas_size.width;
	game_canvas.height = config.canvas_size.height;
	graphics.scale(1, 1);
}

/* 
------------------------------
------- MAIN SECTION  -------- 
------------------------------
*/

/** @type {Number} last frame time in seconds */
var last_time = null;

/** @type {Number} A counter representing the number of update calls */
var loop_count = 0;

/** @type {Number} A counter that is used to assign bodies a unique identifier */
var running_id = 0;

/** @type {Number} A counter that is used to count the number of times an enemy is hit with a projectile */
var enemiesHit = 0;

/** @type {Number} A counter that is used to count the number of spawned enemies */
var enemyCount = 0;

/** @type {Number} A counter that is used to determine the time game has been on, is not affected by player death */
var masterTime = 0;

/** @type {Number} A counter that is used to determine how long player has been alive */
var timeAliveCount = 0;

/** @type {Number} A helper for timeAliveCount */
var prevAliveCount = 0;

/** @type {Number} A counter that is used to see what the players current score is */
var currerntHighScore = 0;

/** @type {Number} A counter that is used to see what the overall high score is */
var masterHighScore = 0;

/** @type {Number} A helper for firing off projectiles at the right interval */
var projShotTime = 0;

/** @type {Object<Number, Body>} This is a map of body ids to body instances */
var entities = null;

/** @type {Array<Number>} This is an array of body ids to remove at the end of the update */
var queued_entities_for_removal = null;

/** @type {Player} The active player */
var player = null;

/* You must implement this, assign it a value in the start() function */
var enemy_spawner = null;

/* You must implement this, assign it a value in the start() function */
var collision_handler = null;

/**
 * This function updates the state of the world given a delta time.
 * 
 * @param {Number} delta_time Time since last update in seconds.
 */
function update(delta_time) {
	// poll input
	player.input_handler.pollController();

	// move entities
	Object.values(entities).forEach(entity => {
		entity.update(delta_time);
	});

	// detect and handle collision events
	if (collision_handler != null) {
		collision_handler.update(delta_time);
	}

	// remove enemies
	queued_entities_for_removal.forEach(id => {
		player.enemies.splice(id, 1)
		player.projectiles.splice(id, 1)
		delete entities[id];
	})
	queued_entities_for_removal = [];

	// spawn enemies
	if (enemy_spawner != null) {
		enemy_spawner.update(delta_time);

	}

	// allow the player to restart when dead
	if (player.isDead() && player.controller.action_1) {
		start();
	}
}


/**
 * This function draws the state of the world to the canvas.
 * 
 * @param {CanvasRenderingContext2D} graphics The current graphics context.
 */
function draw(graphics) {
	// default font config
	graphics.font = "10px Arial";
	graphics.textAlign = "left";

	// draw background (this clears the screen for the next frame)
	graphics.fillStyle = '#FFFFFF';
	graphics.fillRect(0, 0, config.canvas_size.width, config.canvas_size.height);

	// for loop over every eneity and draw them
	Object.values(entities).forEach(entity => {
		entity.draw(graphics);
	});

	// game over screen
	if (player.isDead()) {
		graphics.font = "30px Arial";
		graphics.textAlign = "center";
		graphics.fillText('Game Over', config.canvas_size.width / 2, config.canvas_size.height / 2);

		graphics.font = "12px Arial";
		graphics.textAlign = "center";
		graphics.fillText('press space to restart', config.canvas_size.width / 2, 18 + config.canvas_size.height / 2);
	}
}

/**
 * This is the main driver of the game. This is called by the window requestAnimationFrame event.
 * This function calls the update and draw methods at static intervals. That means regardless of
 * how much time passed since the last time this function was called by the window the delta time
 * passed to the draw and update functions will be stable.
 * 
 * @param {Number} curr_time Current time in milliseconds
 */
function loop(curr_time) {
	// convert time to seconds
	curr_time /= 1000;

	// edge case on first loop
	if (last_time == null) {
		last_time = curr_time;
	}

	var delta_time = curr_time - last_time;

	timeAliveCount = curr_time - prevAliveCount
	masterTime = curr_time
	if (player.health == 0) {timeAliveCount = prevAliveCount}
	currerntHighScore = Math.floor(30 * enemiesHit + timeAliveCount)
	if (currerntHighScore > masterHighScore) {
		masterHighScore = currerntHighScore
	}

	// this allows us to make stable steps in our update functions
	while (delta_time > config.update_rate.seconds) {
		update(config.update_rate.seconds);
		draw(graphics);

		delta_time -= config.update_rate.seconds;
		last_time = curr_time;
		loop_count++;

		game_state.innerHTML = `loop count ${loop_count}`;
		numHits.innerHTML = `kill count ${enemiesHit}`;
		timeAlive.innerHTML = `time alive ${player.health > 0 ? Math.round(timeAliveCount) : 0}`;
		enemyCountSpan.innerHTML = `enemy count ${player.health > 0 ? enemyCount : 0}`;
		totalScore.innerHTML = `total score ${player.health > 0 ? currerntHighScore : 0}`;
		highScore.innerHTML = `high score ${masterHighScore}`;
		health.innerHTML = `health ${player.health}`;
	}

	window.requestAnimationFrame(loop);
}

function start() {
	//resets all the stats
	if (currerntHighScore > masterHighScore) {
		masterHighScore = currerntHighScore
	}
	prevAliveCount = masterTime
	enemiesHit = 0;
	enemyCount = 0
	timeAliveCount = 0

	entities = [];
	queued_entities_for_removal = [];
	player = new Player();

	enemy_spawner = new Enemy()
	// collision_handler = your implementation
}

// start the game
start();

// start the loop
window.requestAnimationFrame(loop);