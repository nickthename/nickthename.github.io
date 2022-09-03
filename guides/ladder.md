---
layout: post
title: "Ladder Mechanics and Issues"
date: 2022-09-20
draft: false
---
I recently got back from Smashtoberfest in Houston, which along with a couple of recent online tournaments used start.gg's Ladder format. Here's a rundown of how it works, and my thoughts on ladder for competition. 
## What's the goal of ladder?
The point of the ladder is to allow players to play matches at their own pace. Instead of being assigned to a pool, players queue up  for matches on their phone, are assigned an opponent, then report directly when they finish. Reporting through the app mostly removes the need for pool captains, and the system allows very high setup utilization and gives each player a lot of matches. 

## How Smashgg's Ladder Works
Ladder operates on very different logic than other tournament formats, and has a lot of implementation details that are important to know if you plan on playing it. 


In the ladder, each win is worth 1 star, with the exception of wins that promote into a new tier, which grants an additional star. Losses always remove 1 star. The **quality of wins or losses is irrelevant**, a win against Isai is worth just as much as a win against the guy who keeps asking how to turn off tap jump. Players start at tier 1, with 1 star. It's impossible to fall below tier 1 with 0 stars; losing additional matches at that point doesn't hurt your tier. 


How matches are determined is a bit opaque. The system seems to try at least a little to match you with opponents at a similar skill level, however its ability to do that is very restricted. The system has no knowledge of seeding as far as I can tell, so from its perspective any player with 2 wins is equivalent, regardless of who those wins are against. It also avoids rematches within an amount of time configurable by the TO; at Smashtoberfest rematches were disabled entirely. The system tries to keep queue times very low when possible - it won't force you to wait to find the perfect match.


It's impossible to leave queue manually. This is a bit annoying when playing in low population ladders online. Once a match is found, you'll have a minute or two to check-in or else get kicked out of the queue. To prevent dodging, the opponent's name isn't visible before checking in.
Ranking in a ladder uses **peak rank, not current rank**, with win % used as a tiebreaker. A player who was once Rookie 3★ but has fallen to Rookie 0★ will still be ranked above a player whose current and highest rank is Roolie 2★.

## Problems with Ladder

To me, ladder has two main issues for competition: tactical play and inaccurate rankings. 
Tactical play includes queueing to snipe or avoid specific players, or not queueing to avoid risking losses. In normal tournaments using round robin in double elimination, players have no control over who they play against, which means the only skill being tested is ability to play the game. With ladder, a weaker player can be ranked over a stronger one if they better understand the system. 
The combination of ladders not being seeded and all wins and losses being considered equal means ladder results often don't reflect player skill. Getting paired against weaker opponents is a huge advantage and often comes down to luck of the draw. The main way it can be influenced is by trying to play matches as fast as possible, in order to play people before ranks can shake out, as well as get more chances at a high peak rank. This advantages some characters and playstyles over others in a way no other format does, and encourages rushing over playing your best. 

## Summary
Ladder is a cool idea, and getting to play opponents at your own pace is fun, but both the core design and start.gg's implementation have serious flaws for use in competitive play. 
I'd like to hear you all's thoughts on ladder if you've tried it, or other formats that might be worth trying.
