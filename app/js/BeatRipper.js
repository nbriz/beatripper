function BeatRipper( config, callback ){

	var self = this;
	
	if( typeof BB.Audio.context === "undefined" )
		throw new Error('BeatRipper: is a BB.Audio Add-On, which require that you first create an AudioContext: BB.Audio.init()');
	
	if(typeof config === "object"){
		this.type = (typeof config.filter==="undefined") ? "lowpass" : config.filter;
	} else if(typeof config === "string"){
		this.type = "lowpass"
		config = { path:config };
	} else {
		throw new Error('BeatRipper: expecting either a path or a config object, with a file [path], additional/optional parameters: [filter], [frequency], [Q], [gain], [threshold] ')
	}

	var types = ["lowpass", "highpass", "bandpass", "lowshelf", "highshelf", "peaking", "notch", "allpass"];
	if( types.indexOf(this.type) < 0 )
		throw new Error('BeatRipper: type should be either, "lowpass", "highpass", "bandpass", "lowshelf", "highshelf", "peaking", "notch" or "allpass"');
	if( typeof config.path !== "string" )
		throw new Error('BeatRipper: path should be a file path (string)');

	this.buffer = null;			// sound buffer for the file at config.path
	this.doGui = (typeof config.gui==="undefined") ? false : config.gui;

	// for peaks
	this.threshold = (typeof config.threshold==="undefined") ? 0.66 : config.threshold;
	this.peaks = [];
	this.tempoCandidates = [];
	this.tempo = -1;


	// BB.Audio Modules 
	
	this.fft = new BB.AudioAnalyser();

	this.filt = new BB.AudioFX('filter',{
		connect: 	this.fft.node,
		type: 		this.type,
		frequency: 	(typeof config.frequency==="undefined") ? 74 : config.frequency,
		Q: 			(typeof config.Q==="undefined") 		? 11 : config.Q,
		gain: 		(typeof config.gain==="undefined") 		? 0 : config.gain
	});

	this.track = new BB.AudioSampler({
		
		connect: 	this.filt.node,
		file: 		config.path

	}, function( bufferObj ){

		var buff 	= bufferObj['file'];	
		self.track.play('file');
		self.track.node.stop();
		self.buffer = buff; 
				
		if(self.doGui) self.GUI = new BeatRipperGUI( self );
		if( typeof callback === "function" ) self.process(function(obj){ callback(obj) })
	});
}

BeatRipper.prototype.process = function( callback ){

	var self = this;

	var offlineContext = new OfflineAudioContext( self.buffer.numberOfChannels, self.buffer.length, self.buffer.sampleRate );
	
	var source = offlineContext.createBufferSource();
	source.buffer = this.buffer;
	
	// mirror filt
	var filter 				= offlineContext.createBiquadFilter();
	filter.type 			= this.filt.node.type;
	filter.frequency.value 	= this.filt.frequency;
	filter.Q.value 			= this.filt.Q;
	filter.gain.value 		= this.filt.gain;
	
	source.connect(filter);
	filter.connect(offlineContext.destination);

	source.start(0);
	offlineContext.startRendering()
	offlineContext.oncomplete = function(e) {

		var buff = e.renderedBuffer; // filtered buffer

		if( self.doGui ){
			var chnlData = self.fft.getResampledBufferData( buff, self.GUI.ele[2].width ); 
			self.GUI.drawWaveform( chnlData );
		}

		self.peaks = self._findPeaks( buff );
		self.tempo = self._calculateBPM( callback );

	};

};

BeatRipper.prototype.rip =  function(){
	var self = this;

	if(this.tempo<=0) throw new Error('BeatRipper.rip: you must first .process() the sample to find the tempo in order to rip the script')

	// quarterNotes = the number of "beats" in the track
	var quarterNotes = (function(){
		var min = Math.floor(self.buffer.duration/60);
		var rem = (self.buffer.duration/60) - min;
		var num = self.tempo * min;
			num += self.tempo * rem;
		return Math.round(num);
	}());

	var numOf16th = quarterNotes * 4;
	var sixteenth = self.buffer.length/numOf16th; // size of 16th relative to buffer
	var mkr = { IN:0, OUT:sixteenth };
	var script = [];

	for (var s = 0; s < numOf16th; s++) {
		// check if peak in 16th beat
		var inrange = false;
		for (var i = 0; i < self.peaks[0].length; i++) {
			var p = self.peaks[0][i];
			if( p >= mkr.IN && p <= mkr.OUT ){ 
				inrange = true; break;
			}
		};
		if(inrange) script.push( true );
		else script.push( false );
		// move on to next 16th beat
		mkr.IN  = mkr.OUT;
		mkr.OUT += sixteenth;
	};
	return script;
}


/*
// _ _ | _ _ | _ _ | _ _ | _ _ | _ _ | _ _ | _ _ | _ _ | _ _ | _ _ | _ _ | _ _ | _ _ | _ _ | _ _ | _ _ | _ _ \\
|| _ _   _ _   _ _   _ _   _ _   _ _   _ _   _ _   _ _   _ _   _ _   _ _   _ _   _ _   _ _   _ _   _ _   _ _ || 
\\     |     |     |     |     |     |     |     |     |     |     |     |     |     |     |     |     |     //
*/

BeatRipper.prototype._findPeaks = function( buffer ){
	// props to: http://tech.beatport.com/2014/web-audio/beat-detection-using-web-audio/
	
	var data 	= []; // bufferData
	var peaks 	= []; // where the peaks at ( index relative to data )

	for (var i = 0; i < buffer.numberOfChannels; i++) {
		var chnlData = buffer.getChannelData(i);
		data.push( chnlData );
		peaks.push( [] );
	}

	for (var j = 0; j < data.length; j++) {
		var length = data[j].length;
		for(var i = 0; i < length;) {
			if (data[j][i] > this.threshold) {
				peaks[j].push(i);
				i += 10000; // skip fwd 1/4s ( ~44100/4  ) to get past this peak 
			}
			i++;
		}
	};
	
	if( this.doGui ){
		this.GUI.drawPeaks( peaks, data[0].length );
	}

	return peaks;
};

BeatRipper.prototype._calculateBPM = function( callback ){

	// 1. create milti-channel (multi-dimentional-array) lists (array) of { interval:#, count:# } ( intervals between nearby peaks )
	var chnlIntCnts = this._countIntervalsBetweenNearbyPeaks();

	// 2. create milti-channel (multi-dimentional-array) lists (array) of { tempo:#, count:# } ( tempo 'gueses' objects )
	var chnlTempoCnts = this._groupTempoGuesses( chnlIntCnts )

	// 3. find tempo candidates [ this.tempoCandidates ] ie. top guesses
	this.tempoCandidates = [];
	for (var i = 0; i < chnlTempoCnts.length; i++) {
		for (var j = 0; j < 5; j++) {
			var candidate = chnlTempoCnts[i][j];
			var alreadyThere = false;
			for (var a = 0; a < this.tempoCandidates.length; a++) {
				if( candidate.tempo === this.tempoCandidates[a].tempo ){
					alreadyThere = true;
					this.tempoCandidates[a].count += candidate.count;
					break;
				}
			};
			if(!alreadyThere){
				this.tempoCandidates.push( candidate );
			}
		};
	};

	// 4. find tempo, ie. best guess ( the one with the most counts )
	var tempObj = {count:0,tempo:0};
	for (var i = 0; i < this.tempoCandidates.length; i++) {
		if( this.tempoCandidates[i].count > tempObj.count )
			tempObj = this.tempoCandidates[i];
	};

	// 5. draw to gui ( if gui )
	if( this.doGui ) this.GUI.drawBPM( tempObj.tempo );
	

	// EXEC RIPPER CALLBACK !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
	if(typeof callback == "function"){
		callback({
			tempo: tempObj.tempo
		});
	}
	// EXEC RIPPER CALLBACK !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
	
	return tempObj.tempo;
};

/*
// _ _ | _ _ | _ _ | _ _ | _ _ | _ _ | _ _ | _ _ | _ _ | _ _ | _ _ | _ _ | _ _ | _ _ | _ _ | _ _ | _ _ | _ _ \\
|| _ _   _ _   _ _   _ _   _ _   _ _   _ _   _ _   _ _   _ _   _ _   _ _   _ _   _ _   _ _   _ _   _ _   _ _ || 
\\     |     |     |     |     |     |     |     |     |     |     |     |     |     |     |     |     |     //
*/

BeatRipper.prototype._countIntervalsBetweenNearbyPeaks = function() {

	var chnlIntCnts = [];

	for (var i = 0; i < this.peaks.length; i++) {
		var peaks = this.peaks[i];
		// props to: http://tech.beatport.com/2014/web-audio/beat-detection-using-web-audio/
		var intervalCounts = [];
		peaks.forEach(function(peak, index) {
			for(var i = 0; i < 10; i++) {
				var interval = peaks[index + i] - peak;
				var foundInterval = intervalCounts.some(function(intervalCount) {
					if (intervalCount.interval === interval)
						return intervalCount.count++;
				});
				if (!foundInterval) {
					intervalCounts.push({
						interval: interval,
						count: 1
					});
				}
			}
		});
		// -------------------------------------------------------------------------------
		chnlIntCnts.push( intervalCounts );
	};

	return chnlIntCnts;
};

BeatRipper.prototype._putTempoInRange = function( val, min, max ){
	if( val === 0 ){
		return Math.round(val);
	}
	else if( val < min ){

		while( val < min ) val *= 2;
		return Math.round(val);

	} else if( val > max ){

		while( val > max ) val /= 2;
		return Math.round(val);

	} else {
		return Math.round(val);
	}
}

BeatRipper.prototype._removeIf = function( array, callback) {
    // via: http://stackoverflow.com/a/15996017
    var i = array.length;
    while (i--) {
        if (callback(array[i], i)) {
            array.splice(i, 1);
        }
    }
    return array;
};

BeatRipper.prototype._groupTempoGuesses = function(chnlIntCnts, intervalCounts) {

	var chnlTempoCnts = [];
	
	for (var i = 0; i < chnlIntCnts.length; i++) {
		var intervalCounts = chnlIntCnts[i];
		// remix'd from: http://tech.beatport.com/2014/web-audio/beat-detection-using-web-audio/
		var self = this;
		var tempoCounts = []
		intervalCounts.forEach(function(intervalCount, i) {
			// Convert an interval to tempo
			var theoreticalTempo = 60 / (intervalCount.interval / self.buffer.sampleRate );
				theoreticalTempo = (isNaN(theoreticalTempo)||theoreticalTempo===Infinity) ? 0 : theoreticalTempo;

			theoreticalTempo = self._putTempoInRange( theoreticalTempo, 90, 180 );

			var foundTempo = tempoCounts.some(function(tempoCount) {
				if (tempoCount.tempo === theoreticalTempo)
					return tempoCount.count += intervalCount.count;
			});

			if (!foundTempo) {
				tempoCounts.push({
					tempo: theoreticalTempo,
					count: intervalCount.count
				});
			}
		});
		//  -----------------------------------------------------------------------------------

		// remove the 0's
		tempoCounts = this._removeIf( tempoCounts, function(item){
			return item.tempo === 0;
		});

		// sort from most likely to least
		tempoCounts.sort(function(a, b){
			return b.count - a.count;
		});

		chnlTempoCnts.push( tempoCounts );
	};
	return chnlTempoCnts;
};


