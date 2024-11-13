class Chip8 {
  constructor() {
    /* MEMORY */
    this.mem = new Uint8Array(4096); // 4K memory

    /* REGISTERS */
    this.V = new Uint8Array(16); // 16 8-bit general purpose registers (V0 - VF)
    this.I = 0; // Index register
    this.dt = 0; // Delay timer
    this.st = 0; // Sound timer
    this.pc = 0x200; // Program Counter. Starts at 512 (0x200)

    /* STACK */
    this.stack = new Uint16Array(16); // 16 16-bit values
    this.sp = 0; // Stack pointer

    /* GRAPHICS */
    this.gfx = new Uint8Array(64 * 32); // 2048 pixels display
    this.drawFlag = false; // Flag to update the display

    /* KEYPAD */
    this.key = new Uint8Array(16); // 0x0 - 0xF keys
    this.chip8Fontset = new Uint16Array([
      0xf0,
      0x90,
      0x90,
      0x90,
      0xf0, //0
      0x20,
      0x60,
      0x20,
      0x20,
      0x70, //1
      0xf0,
      0x10,
      0xf0,
      0x80,
      0xf0, //2
      0xf0,
      0x10,
      0xf0,
      0x10,
      0xf0, //3
      0x90,
      0x90,
      0xf0,
      0x10,
      0x10, //4
      0xf0,
      0x80,
      0xf0,
      0x10,
      0xf0, //5
      0xf0,
      0x80,
      0xf0,
      0x90,
      0xf0, //6
      0xf0,
      0x10,
      0x20,
      0x40,
      0x40, //7
      0xf0,
      0x90,
      0xf0,
      0x90,
      0xf0, //8
      0xf0,
      0x90,
      0xf0,
      0x10,
      0xf0, //9
      0xf0,
      0x90,
      0xf0,
      0x90,
      0x90, //A
      0xe0,
      0x90,
      0xe0,
      0x90,
      0xe0, //B
      0xf0,
      0x80,
      0x80,
      0x80,
      0xf0, //C
      0xe0,
      0x90,
      0x90,
      0x90,
      0xe0, //D
      0xf0,
      0x80,
      0xf0,
      0x80,
      0xf0, //E
      0xf0,
      0x80,
      0xf0,
      0x80,
      0x80, //F
    ]);

    /* OPCODES */
    this.opcode = 0; // Current opcode
  }

  Initialize() {
    // Initialize registers and memory once
    this.pc = 0x200; // Program counter starts at 0x200
    this.opcode = 0; // Reset current opcode
    this.I = 0; // Reset index register
    this.sp = 0; // Reset stack pointer

    // Clear display
    for (let i = 0; i < 2048; ++i) this.gfx[i] = 0;

    // Clear stack
    for (let i = 0; i < 16; ++i) this.stack[i] = 0;

    for (let i = 0; i < 16; ++i) this.key[i] = this.V[i] = 0;

    // Clear memory
    for (let i = 0; i < 4096; ++i) this.mem[i] = 0;

    // Load fontset
    for (let i = 0; i < 80; ++i) this.mem[i] = this.chip8Fontset[i];

    // Reset timers
    this.dt = 0;
    this.st = 0;

    // Clear screen once
    this.drawFlag = true;
  }

  // Function to load a program into the memory
  async LoadProgram(file) {
    console.log("Loading program: " + file.name);

    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onerror = () => {
        console.error("Error reading file.");
        reject("File read error");
      };

      reader.readAsArrayBuffer(file);

      reader.onload = () => {
        const arrayBuffer = reader.result;
        const byteArray = new Uint8Array(arrayBuffer);

        if (!byteArray) {
          console.error(
            "Error loading program. The byte array loaded is null."
          );
          reject("Error: Loaded byte array is null");
          return;
        }

        const lSize = byteArray.length;

        // Load bytes if ROM size fits the memory
        if (4096 - 512 > lSize) {
          for (let i = 0; i < lSize; ++i) {
            this.mem[i + 512] = byteArray[i];
          }
          console.log("Program loaded successfully.");
          resolve();
        } else {
          console.error("Error: ROM too big for memory");
          reject("Error: ROM too big for memory");
        }
      };
    });
  }

  emulateCycle() {
    // Fetch Opcode. Get current byte and next one.
    this.opcode = (this.mem[this.pc] << 8) | this.mem[this.pc + 1];

    //console.log(opcode.toString(16));
    // Decode&Execute Opcode
    switch (this.opcode & 0xf000) {
      case 0x0000:
        switch (this.opcode & 0x000f) {
          case 0x0000: // 00E0: Clear the display
            this.gfx.fill(0);
            this.drawFlag = true;
            this.pc += 2;
            break;

          case 0x000e: // 00EE: Return from a subroutine
            --this.sp;
            this.pc = this.stack[this.sp];
            this.pc += 2;
            break;

          default:
            console.error("Unknown opcode: " + opcode.toString(16));
            break;
        }
        break;

      case 0x1000: // 1NNN: Jumps to address NNN
        this.pc = this.opcode & 0x0fff;
        break;

      case 0x2000: // 2NNN: Calls subroutine at NNN
        this.stack[this.sp] = this.pc;
        ++this.sp;
        this.pc = 0x0fff & this.opcode;
        break;

      case 0x3000: // 3XKK: Skip next instruction if Vx = kk.
        if (this.V[(this.opcode & 0x0f00) >> 8] == (this.opcode & 0x00ff))
          this.pc += 4;
        else this.pc += 2;
        break;

      case 0x4000: // 4XKK: Skip next instruction if Vx != kk.
        if (this.V[(this.opcode & 0x0f00) >> 8] != (this.opcode & 0x00ff))
          this.pc += 4;
        else this.pc += 2;
        break;

      case 0x5000: // 5XY0: Skip next instruction if Vx = Vy.
        if (
          this.V[(this.opcode & 0x0f00) >> 8] ==
          this.V[(this.opcode & 0x00f0) >> 4]
        )
          this.pc += 4;
        else this.pc += 2;
        break;

      case 0x6000: // 6XKK: Set Vx = kk.
        this.V[(this.opcode & 0x0f00) >> 8] = this.opcode & 0x00ff;
        this.pc += 2;
        break;

      case 0x7000: // 7XKK: Set Vx = Vx + kk.
        this.V[(this.opcode & 0x0f00) >> 8] += this.opcode & 0x00ff;
        this.pc += 2;
        break;

      case 0x8000:
        switch (this.opcode & 0x000f) {
          case 0x0000: // 8XY0: Set Vx = Vy.
            this.V[(this.opcode & 0x0f00) >> 8] =
              this.V[(this.opcode & 0x00f0) >> 4];
            this.pc += 2;
            break;

          case 0x0001: // 8XY1: Set Vx = Vx OR Vy.
            this.V[(this.opcode & 0x0f00) >> 8] |=
              this.V[(this.opcode & 0x00f0) >> 4];
            this.pc += 2;
            break;

          case 0x0002: // 8XY2: Set Vx = Vx AND Vy.
            this.V[(this.opcode & 0x0f00) >> 8] &=
              this.V[(this.opcode & 0x00f0) >> 4];
            this.pc += 2;
            break;

          case 0x0003: // 8XY3: Set Vx = Vx XOR Vy.
            this.V[(this.opcode & 0x0f00) >> 8] ^=
              this.V[(this.opcode & 0x00f0) >> 4];
            this.pc += 2;
            break;

          case 0x0004: // 8XY4: Set Vx = Vx + Vy, set VF to 1 if carry, otherwise 0.
            if (
              this.V[(this.opcode & 0x00f0) >> 4] >
              0xff - this.V[(this.opcode & 0x0f00) >> 8]
            )
              this.V[0xf] = 1;
            else this.V[0xf] = 0;
            this.V[(this.opcode & 0x0f00) >> 8] +=
              this.V[(this.opcode & 0x00f0) >> 4];
            this.pc += 2;
            break;

          case 0x0005: // 8XY5: Set Vx = Vx - Vy, set VF to 1 if Vx > Vy, otherwise 0.
            if (
              this.V[(this.opcode & 0x0f00) >> 8] >
              this.V[(this.opcode & 0x00f0) >> 4]
            )
              this.V[0xf] = 1;
            else this.V[0xf] = 0;
            this.V[(this.opcode & 0x0f00) >> 8] -=
              this.V[(this.opcode & 0x00f0) >> 4];
            this.pc += 2;
            break;

          // If the least-significant bit of Vx is 1, then VF is set to 1, otherwise 0.??
          case 0x0006: // 8XY6: Shifts VX right by one. VF is set to the value of the least significant bit of VX before the shift
            this.V[0xf] = this.V[(this.opcode & 0x0f00) >> 8] & 0x1;
            this.V[(this.opcode & 0x0f00) >> 8] >>= 1;
            this.pc += 2;
            break;

          case 0x0007: // 8XY7: If Vy > Vx, then VF is set to 1, otherwise 0. Then Vx is subtracted from Vy, and the results stored in Vx.
            if (
              this.V[(this.opcode & 0x00f0) >> 4] >
              this.V[(this.opcode & 0x0f00) >> 8]
            )
              this.V[0xf] = 1;
            else this.V[0xf] = 0;
            this.V[(this.opcode & 0x0f00) >> 8] =
              this.V[(this.opcode & 0x00f0) >> 4] -
              this.V[(this.opcode & 0x0f00) >> 8];
            this.pc += 2;
            break;

          // If the most-significant bit of Vx is 1, then VF is set to 1, otherwise to 0.
          case 0x000e: // 8XYE: Shifts VX left by one. VF is set to the value of the most significant bit of VX before the shift
            this.V[0xf] = this.V[(this.opcode & 0x0f00) >> 8] >> 7;
            this.V[(this.opcode & 0x0f00) >> 8] <<= 1;
            this.pc += 2;
            break;

          default:
            console.error("Unknown opcode: " + this.opcode.toString(16));
            break;
        }
        break;

      case 0x9000: // 9XY0: Skip next instruction if Vx != Vy.
        if (
          this.V[(this.opcode & 0x0f00) >> 8] !=
          this.V[(this.opcode & 0x00f0) >> 4]
        )
          this.pc += 4;
        else this.pc += 2;
        break;

      case 0xa000: // Annn: Set I = nnn.
        this.I = this.opcode & 0x0fff;
        this.pc += 2;
        break;

      case 0xb000: // Bnnn: Jump to location nnn + V0.
        this.pc = (this.opcode & 0x0fff) + this.V[0];
        break;

      case 0xc000: // CXKK: Set Vx = random byte AND kk.
        const rand = Math.floor(Math.random() * 256);
        this.V[(this.opcode & 0x0f00) >> 8] = this.rand & (this.opcode & 0xff);
        this.pc += 2;
        break;

      case 0xd000: // DXYN: Draws a sprite at coordinate (VX, VY) that has a width of 8 pixels and a height of N pixels.
        // Each row of 8 pixels is read as bit-coded starting from memory location I;
        // I value doesn't change after the execution of this instruction.
        // VF is set to 1 if any screen pixels are flipped from set to unset when the sprite is drawn,
        // and to 0 if that doesn't happen
        const x = this.V[(this.opcode & 0x0f00) >> 8];
        const y = this.V[(this.opcode & 0x00f0) >> 4];
        const height = this.opcode & 0x000f;
        let pixel;

        this.V[0xf] = 0;
        for (let yline = 0; yline < height; yline++) {
          pixel = this.mem[this.I + yline];
          for (let xline = 0; xline < 8; xline++) {
            if ((pixel & (0x80 >> xline)) != 0) {
              if (this.gfx[x + xline + (y + yline) * 64] == 1) {
                this.V[0xf] = 1;
              }
              this.gfx[x + xline + (y + yline) * 64] ^= 1;
            }
          }
        }

        this.drawFlag = true;
        this.pc += 2;

        break;

      case 0xe000:
        switch (this.opcode & 0x00ff) {
          case 0x009e: // EX9E: Skip next instruction if key with the value of Vx is pressed.
            if (this.key[this.V[(this.opcode & 0x0f009) >> 8]] != 0)
              this.pc += 4;
            else this.pc += 2;
            break;

          case 0x00a1: // EXA1: Skip next instruction if key with the value of Vx is not pressed.
            if (this.key[this.V[(this.opcode & 0x0f00) >> 8]] == 0)
              this.pc += 4;
            else this.pc += 2;
            break;
        }
        break;

      case 0xf000:
        switch (this.opcode & 0x000ff) {
          case 0x0007: // FX07: Set Vx = delay timer value.
            this.V[(this.opcode & 0x0f00) >> 8] = this.dt;
            this.pc += 2;
            break;

          case 0x000a: // FX0A: Wait for a key press, store the value of the key in Vx.
            let keyPress = false;

            for (let i = 0; i < 16; ++i) {
              if (this.key[i] != 0) {
                this.V[(this.opcode & 0x0f00) >> 8] = i;
                keyPress = true;
              }
            }

            // If we didn't received a keypress, skip this cycle and try again.
            if (!keyPress) return;

            this.pc += 2;
            break;

          case 0x0015: // FX15: Set delay timer = Vx
            this.dt = this.V[(this.opcode & 0x0f00) >> 8];
            this.pc += 2;
            break;

          case 0x0018: // FX18: Set sound timer = Vx.
            this.st = this.V[(this.opcode & 0x0f00) >> 8];
            this.pc += 2;
            break;

          case 0x001e: // FX1E: Set I = I + Vx
            if (this.I + this.V[(this.opcode & 0x0f00) >> 8] > 0xfff)
              // VF is set to 1 when range overflow (I+VX>0xFFF), and 0 when there isn't.
              this.V[0xf] = 1;
            else this.V[0xf] = 0;
            this.I += this.V[(this.opcode & 0x0f00) >> 8];
            this.pc += 2;
            break;

          case 0x0029: // FX29: Set I = location of sprite for digit Vx.
            this.I = this.V[(this.opcode & 0x0f00) >> 8] * 0x5;
            this.pc += 2;
            break;

          case 0x0033: // FX33: Stores the Binary-coded decimal representation of VX at the addresses I, I plus 1, and I plus 2
            const Vx = this.V[(this.opcode & 0x0f00) >> 8];

            this.mem[this.I] = Math.floor(Vx / 100);
            this.mem[this.I + 1] = Math.floor(Vx / 10) % 10;
            this.mem[this.I + 2] = (Vx % 100) % 10;

            this.pc += 2;
            break;

          case 0x0055: // FX55: Store registers V0 through Vx in memory starting at location I.
            for (let i = 0; i <= (this.opcode & 0x0f00) >> 8; i++) {
              this.mem[this.I + i] = this.V[i];
            }

            // On the original interpreter, when the operation is done, I = I + X + 1.
            this.I += ((this.opcode & 0x0f00) >> 8) + 1;
            this.pc += 2;
            break;

          case 0x0065: // FX65: Fills V0 to VX with values from memory starting at address I
            for (let i = 0; i <= (this.opcode & 0x0f00) >> 8; ++i) {
              this.V[i] = this.mem[this.I + i];
            }

            // On the original interpreter, when the operation is done, I = I + X + 1.
            this.I += ((this.opcode & 0x0f00) >> 8) + 1;
            this.pc += 2;
            break;
        }
        break;

      default:
        console.error("Unknown opcode: " + opcode.toString(16));
        break;
    }

    // Update timers
    if (this.dt > 0) --this.dt;

    if (this.st > 0) {
      if (this.st == 1) {
        const beepSound = new Audio("assets/beep.mp3");
        beepSound.play();
      }
      --this.st;
    }
  }
}

function setupGraphics() {
  const screen = document.getElementById("canvas");
  context = screen.getContext("2d");
  context.fillStyle = "black";
  multiplier = 10;
  screen.width = 64 * multiplier;
  screen.height = 32 * multiplier;
  context.fillRect(0, 0, screen.width, screen.height);
}

function drawGraphics(chip8) {
  const screen = document.getElementById("canvas");
  const context = screen.getContext("2d");

  const pixelSizeX = screen.width / 64;
  const pixelSizeY = screen.height / 32;

  const imageData = context.getImageData(0, 0, screen.width, screen.height);
  const pixels = imageData.data;

  for (let y = 0; y < 32; y++) {
    for (let x = 0; x < 64; x++) {
      const index = y * 64 + x; // gfx index
      const color = chip8.gfx[index] === 0 ? 0 : 255; // Pixel color

      // Pixels position
      for (let py = 0; py < pixelSizeY; py++) {
        for (let px = 0; px < pixelSizeX; px++) {
          const posX = x * pixelSizeX + px;
          const posY = y * pixelSizeY + py;
          const pixelIndex = (posY * screen.width + posX) * 4;

          pixels[pixelIndex] = color; // R
          pixels[pixelIndex + 1] = color; // G
          pixels[pixelIndex + 2] = color; // B
          pixels[pixelIndex + 3] = 255; // Opacity
        }
      }
    }
  }

  // Render image
  context.putImageData(imageData, 0, 0);
}

function setupInput(chip8) {
  // Set keys on key down
  document.addEventListener("keydown", (event) => {
    switch (event.key) {
      case "1":
        chip8.key[0x1] = 1;
        break;
      case "2":
        chip8.key[0x2] = 1;
        break;
      case "3":
        chip8.key[0x3] = 1;
        break;
      case "4":
        chip8.key[0xc] = 1;
        break;

      case "q":
      case "Q":
        chip8.key[0x4] = 1;
        break;
      case "w":
      case "W":
        chip8.key[0x5] = 1;
        break;
      case "e":
      case "E":
        chip8.key[0x6] = 1;
        break;
      case "r":
      case "R":
        chip8.key[0xd] = 1;
        break;

      case "a":
      case "A":
        chip8.key[0x7] = 1;
        break;
      case "s":
      case "S":
        chip8.key[0x8] = 1;
        break;
      case "d":
      case "D":
        chip8.key[0x9] = 1;
        break;
      case "f":
      case "F":
        chip8.key[0xe] = 1;
        break;

      case "z":
      case "Z":
        chip8.key[0xa] = 1;
        break;
      case "x":
      case "X":
        chip8.key[0x0] = 1;
        break;
      case "c":
      case "C":
        chip8.key[0xb] = 1;
        break;
      case "v":
      case "V":
        chip8.key[0xf] = 1;
        break;
    }
  });

  // Reset keys on keyup
  document.addEventListener("keyup", (event) => {
    switch (event.key) {
      case "1":
        chip8.key[0x1] = 0;
        break;
      case "2":
        chip8.key[0x2] = 0;
        break;
      case "3":
        chip8.key[0x3] = 0;
        break;
      case "4":
        chip8.key[0xc] = 0;
        break;

      case "q":
      case "Q":
        chip8.key[0x4] = 0;
        break;
      case "w":
      case "W":
        chip8.key[0x5] = 0;
        break;
      case "e":
      case "E":
        chip8.key[0x6] = 0;
        break;
      case "r":
      case "R":
        chip8.key[0xd] = 0;
        break;

      case "a":
      case "A":
        chip8.key[0x7] = 0;
        break;
      case "s":
      case "S":
        chip8.key[0x8] = 0;
        break;
      case "d":
      case "D":
        chip8.key[0x9] = 0;
        break;
      case "f":
      case "F":
        chip8.key[0xe] = 0;
        break;

      case "z":
      case "Z":
        chip8.key[0xa] = 0;
        break;
      case "x":
      case "X":
        chip8.key[0x0] = 0;
        break;
      case "c":
      case "C":
        chip8.key[0xb] = 0;
        break;
      case "v":
      case "V":
        chip8.key[0xf] = 0;
        break;
    }
  });
}

/* ######### MAIN ######### */
function main() {
  // Initialize the Chip8 system and load the game into the memory
  const chip8 = new Chip8();

  // Set up render system and register input callbacks
  setupGraphics();
  setupInput(chip8);

  document
    .getElementById("fileInput")
    .addEventListener("change", async (event) => {
      chip8.Initialize();
      const file = event.target.files[0];

      try {
        await chip8.LoadProgram(file);
        console.log("Memory after loading program:", chip8.mem);

        // Emulation loop
        const freq = 1000 / 500; // 500 Hz
        const intervalId = setInterval(() => {
          // Emulate one cycle
          chip8.emulateCycle();
          for (let index = 0; index < chip8.gfx.length; index++) {
            const element = chip8.gfx[index];
          }

          // If the draw flag is set, update the screen
          if (chip8.drawFlag) drawGraphics(chip8);
        }, freq);
      } catch (error) {
        console.error(error);
      }
    });
}

main();
