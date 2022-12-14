LD51 - Every 10 Seconds
============================

Ludum Dare 51 Entry by Jimbly - "Spacemine Defense"

* Play here: [dashingstrike.com/LudumDare/LD51/](http://www.dashingstrike.com/LudumDare/LD51/)
* Using [Javascript libGlov/GLOV.js framework](https://github.com/Jimbly/glovjs)

Start with: `npm start` (after running `npm i` once)

MVP
X 2 weapons
X 2 enemy types
X main menu, title screen
  X 3 levels
  X high score lists
  X game over / you win screens
X level defs
  X need actual no danger
  X pacing of waves
X Fast forward / menu buttons
X music bgm
X music menu
X SFX
X New asteroid if no other gfx
  X 2 size variations
X button GFX
* waves ramp up in difficulty
* stretch:
  X scrolling background texture
  X particles
  * art pass
  * more units: (need to rebalance level choices)
    * repair (packets?)
    * boosters
    * more enemies / weapons
  * get more money back from scrapping unbuilt things
  * random easy/med/hard level select
  * only do N search for targets each frame

The 10 Second Space Game
X Field of asteroids
X First unit: minor miner
X Select miner, place on map, builds instantly, minerals start coming in, asteroids get depleted
  X miners change color
  X miners show dig arrow sprite too
* Next: simulation functionality:
  X Second unit: Factory, generates supplies
    X Supplies are stored up to some partial capacity (so building can start immediately, if there was any left)
  X Building takes supplies
  X Mining takes supplies
  X Build routers
  * Rules:
    X Factories have orders for where to send packets to - having an order in place counts as in-flight
    X Whenever a packet is delivered, if we can use 1 whole additional packet, request another from the nearest available by adding to order queue (should dispatch immediately)
    X Units that are building should be the same as anything else that needs supplies
    X On 10 second tick:
      X In a round robin fashion, add an order to send a packet to every unit who can fit any additional supply, at most 1 per unit
      * probably priority of: building > weapons > miners
  X Supplies travel on links
  X Do not allow supply links overlapping nodes, or nodes placed over links
  X Can select ents and see their status: current+max supply, value left on asteroids, etc
    X Also, scrap them
X Factories should visually count up to 10 somehow, as well as show that they're out of, or have, supplies
X Progress
  X Show progress to completing the whole level, show time elapsed, this should be a filling up bar, probably?
X Then: waves of enemies?  Is this fun already, how much time is left? =)
* Enemies need random chance to change their target
* Weapons
* Currently being built stuff should take extra damage, and also refund some when destroyed
* Unified display of "things out of supply" with a red line through them?
* Next unit: other supply generator (cheap, cannot be tightly packed)?
* Unit ideas:
  * Miner Booster
  * Weapons Booster
  * Weapons Storage / Build Storage (just stores supplies only to be released for weapons/building)
  * Laser/MG
  * Missile
  * Cannon
  * Repair
* Alternative skin: Dwarves
  * Supply is dwarves, dwarves get sent to work the mines, man the forts, etc

Original brainstorming:
* 10 Second RTS
  * Lane based, ~5 lanes for your troops to be in
  * Controls are moving your troops between lanes
  * The constantly charge forward/attack
  * Troop types: infantry, archers, cavalry, general
  * Flanking, bonuses, etc
  * Between battles, re-buy troops, upgrades, etc, world map?
* The Space Game with 10 second pacing
  * Probably: energy production is once every 10 seconds, energy is distributed round-robin up to the maximum capacity of each thing, miners take 1 energy every 10 seconds, so should usually fully operate, lasers maybe 10, so may operate half the time, or accumulate 1 energy each 10s and spend it in a burst
    * Maybe even want to be able to control how much energy each thing gets, so you can intentionally have slow-charging lasers?  No, too complex, and just letting them quickly charge to max should let other things get more energy next tick
    * Battery nodes (only distribute power farther down the tree)
  * New enemies spawn each 10s
  * Currencies: Minerals and Energy
    * Energy traverses the tree visibly, minerals is just on-screen number
    * Building something takes energy? maybe? or, a builder node, can hold 10 energy to hold 10 build units, and building takes one of those (but can be done at a rate higher than once every 10s, unless exhausted)
      * Ideally minerals consumed only when (a portion of) the building is built (or, consumed immediately, but refunded if the building is destroyed before being finished?  maybe not, who cares?)
  * Pacing of enemy wave taking ~30s to arrive is probably ideal
  * Goal like The Space Game: mine all of the minerals and survive in minimal time
