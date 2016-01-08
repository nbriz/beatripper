BB.A2VUtils = function(){};

BB.A2VUtils.drawFilterShape = function( filter, canvas, config ){

	if( !(filter instanceof BB.AudioFX) || filter.type!=="filter" )
		throw new Error('BB.A2VUtils.drawFilterShape: first parameter expecting an instanceof BB.AudioFX("filter")');
	if( !(canvas instanceof HTMLCanvasElement) )
		throw new Error('BB.A2VUtils.drawFilterShape: second parameter expecting an instanceof HTMLCanvasElement'); 

	if(typeof config !== "object") config = {}
	// { stroke:"#fff", weight:3, fill:"#000", x:0, y:0, width:100, height:100 }

	var stroke 	= (typeof config.stroke !== "undefined") ? config.stroke : "#e40477";
	var x 		= (typeof config.x !== "undefined") ? config.x : 0;
	var y 		= (typeof config.y !== "undefined") ? config.y : 0;
	var width 	= (typeof config.width !== "undefined") ? config.width : canvas.width;
	var height 	= (typeof config.height !== "undefined") ? config.height : canvas.height;
	var weight 	= (typeof config.weight !== "undefined") ? config.weight : 3;

	var ctx = canvas.getContext('2d');
	var freqRes = filter.calcFrequencyResponse( width );

	if(typeof config.fill === "string"){
		ctx.fillStyle = config.fill;
		ctx.fillRect( x, y, width, height );
	}
	
	// some this math via: http://webaudioapi.com/samples/frequency-response/
	
	var dbScale 	= Math.round( height / 4 );
	var dbScale2 	= Math.round( height / 12.5 );
	var pixelsPerDb = (0.25 * height) / dbScale; // originally 0.5 *, but was cutting line too far below bottom? 
	ctx.strokeStyle = stroke;
	ctx.lineWidth 	= weight;
	ctx.beginPath();
	for (var i = 0; i < width; ++i) {
        var magRes 		= freqRes.magResponse[i];
        var dbResponse 	= dbScale2 * Math.log(magRes) / Math.LN10;
        var _x = i+x;
        var _y = y + (0.5 * height) - pixelsPerDb * dbResponse;
        if ( i == 0 ) 	ctx.moveTo( _x, _y );
        else 			ctx.lineTo( _x, _y );
    }
    ctx.stroke();

};

BB.A2VUtils.drawWaveform = function( data, canvas, config ){

	if( !(data instanceof Array) )
		throw new Error('BB.A2VUtils.drawWaveform: first parameter expecting an Array of buffer data resampled by BB.AudioAnalyser.getResampledBufferData');

	/*
		data is a Float32Array (or an array of Float32Array for multi-channel buffers) describing that buffer as follows...       
		we 'resample' with cumul, count, variance
		Offset 0 : PositiveCumul  1: PositiveCount  2: PositiveVariance
		       3 : NegativeCumul  4: NegativeCount  5: NegativeVariance
		that makes 6 data per bucket
	*/
	
	if( !(canvas instanceof HTMLCanvasElement) )
		throw new Error('BB.A2VUtils.drawWaveform: second parameter expecting an instanceof HTMLCanvasElement'); 

	var ctx = canvas.getContext('2d');
	
	if(typeof config !== "object") config = {};
	// { width:100, height:100, colors1:'#fff', colors2:'#000', clear:true }
	var WIDTH 	= (typeof config.width !== "undefined") ? config.width : canvas.width;
	var HEIGHT 	= (typeof config.height !== "undefined") ? config.height : canvas.height;
	var color1 	= (typeof config.color1 !== "undefined") ? config.color1 : '#e40477';
	var color2 	= (typeof config.color2 !== "undefined") ? config.color2 : '#ccc';

	if( config.clear ){
		ctx.clearRect(0,0,canvas.width,canvas.height);	
	}

	for (var ch = 0; ch < data.length; ch++) {
		if(ch==0) ty=HEIGHT*0.25; else ty=HEIGHT*0.74;
		// see: http://stackoverflow.com/a/22103150/1104148 for explination
		ctx.save();
		ctx.translate( 0.5, ty );   
		ctx.scale(1, HEIGHT/2);
		for (var i=0; i< WIDTH; i++) {
			j=i*6;
			// draw from positiveAvg - variance to negativeAvg - variance 
			ctx.strokeStyle = color1;
			ctx.beginPath();
			ctx.moveTo( i  , (data[ch][j] - data[ch][j+2] ));
			ctx.lineTo( i  , (data[ch][j +3] + data[ch][j+5] ) );
			ctx.stroke();
			// draw from positiveAvg - variance to positiveAvg + variance 
			ctx.strokeStyle = color2;
			ctx.beginPath();
			ctx.moveTo( i  , (data[ch][j] - data[ch][j+2] ));
			ctx.lineTo( i  , (data[ch][j] + data[ch][j+2] ) );
			ctx.stroke();
			// draw from negativeAvg + variance to negativeAvg - variance 
			ctx.beginPath();
			ctx.moveTo( i  , (data[ch][j+3] + data[ch][j+5] ));
			ctx.lineTo( i  , (data[ch][j+3] - data[ch][j+5] ) );
			ctx.stroke();
		}
		ctx.restore();
	};
}
