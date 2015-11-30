module.exports = {
	soccer : {
		sport_name: 			"soccer",		//	The name of the Sport
		time_dependant:			false, 			// 	Sport is time dependent (Time is controlled by input ex."Basket")
		main_segments: 2,
		max_segments: 5,
		segments:[
			{
				name:			"Pre Game",		// 	Name of segment / There should alwayz be a Pre Game segment
				timed: 			false			//	Timers advances while in this segment
			},
			{
				name:			"First Half",
				timed:			true,
				initialTime:	0				// Timer should start here in this segment
			},
			{
				name:			"Half Time",
				timed: 			false
			},
			{
				name: 			"Second Half",
				timed: 			true,
				initialTime:	45
			}
		]
		
	}
}