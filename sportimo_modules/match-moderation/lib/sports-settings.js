module.exports = {
	soccer : {
		sport_name: 			"soccer",		//	The name of the Sport
		time_dependant:			false, 			// 	Sport is time dependent (Time is controlled by input ex."Basket")
		main_segments: 2,
		max_segments: 5,
		segments:[
			{
				name:			{en:"Pre Game"},		// 	Name of segment / There should alwayz be a Pre Game segment
				timed: 			false			//	Timers advances while in this segment
			},
			{
				name:			{en:"First Half"},
				timed:			true,
				initialTime:	0				// Timer should start here in this segment
			},
			{
				name:			{en:"Half Time"},
				timed: 			false
			},
			{
				name: 			{en:"Second Half"},
				timed: 			true,
				initialTime:	45
			},
			{
				name:			{en:"Match Ended"},
				timed: 			false
			},
            {
				name: 			{en:"Overtime First Half"},
				timed: 			true,
				initialTime:	90
			},
			{
				name:			{en:"Overtime Half Time"},
				timed: 			false
			},
            {
				name: 			{en:"Overtime Second Half"},
				timed: 			true,
				initialTime:	105
			},
			{
				name:			{en:"Overtime Ended"},
				timed: 			false
			},
			{
				name:			{en:"Penalties"},
				timed: 			false
			}
            
		]
		
	}
}