function BeatRipperGUI( BR ){

	var self = this;

	if( typeof BR === "undefined" || !(BR instanceof BeatRipper) )
		throw new Error('BeatRipperGUI: requires you pass it an instanceof BeatRipper');
	if( typeof BB.A2VUtils === "undefined" ) 
		throw new Error('BeatRipperGUI: depends on the BB.A2VUtils add-on');

	this.BR = BR;							// the instance of the BeatRippre to make a GUI of

	this.color = new BB.Color();
	this.color.createScheme("monochromatic");
	this.clrs = [];									// contains 0-4 monochromatic relatives of this.color
	for (var i = 0; i < this.color.schemes.monochromatic.length; i++) {
		this.clrs.push( this.color.schemes.monochromatic[i].hex );
	};

	// for timeline
	this.mousedown = false;
	this.xPos = 0;
	this.time = BB.Audio.context.currentTime;
	this.playhead = null; 
	this.playing = false;
	this.loop;

	// CSS settings for elements
	// could make editable via config?
	this.css = {
		padding : 25,
		margin : 5,
		border : 1,
		leftWidth : 245,
		rowHeight : 200,
		subHeight : 168	
	}

	this.ele = [];  // 0 = container
					// 1 = filter canvas
					// 2 = wave canvas
					// 3 = controls
					// 4 = peak canvas

	this.createElements();	// the main container/s
	this.drawFilterShape(); // ... top-left
	this.createDatGui();  	// ... bottom-left
	this.drawWaveform();	// ... top-right
	this.createTimeline();  // ... top-right
	this.drawPeaks( this.BR.peaks, this.BR.buffer.getChannelData(0).length ); // ... bottom-right


	window.addEventListener("resize", function(e) {
		var offset = self.css.padding*2 + self.css.border*4 + self.css.margin;
		self.ele[2].width = innerWidth - self.css.leftWidth - offset;
		self.ele[4].width = innerWidth - self.css.leftWidth - offset;
		self.drawWaveform();
		self.drawPeaks( self.BR.peaks, self.BR.buffer.getChannelData(0).length );
	});
}

BeatRipperGUI.prototype.createElements = function(){

	var padding 	= this.css.padding;
	var margin 		= this.css.margin;
	var border 		= this.css.border;
	var leftWidth 	= this.css.leftWidth;
	var rowHeight 	= this.css.rowHeight;
	var subHeight 	= this.css.subHeight;

	var contianer = document.createElement('div');
		contianer.style.position = "relative";
		contianer.style.padding = padding+"px";
		contianer.style.height = rowHeight+subHeight + margin + padding*2 + "px";
	document.body.appendChild( contianer );
	this.ele.push( contianer );

	var filtercanvas = document.createElement('canvas');
		filtercanvas.width = leftWidth;
		filtercanvas.height = rowHeight;
		filtercanvas.style.border = border+"px solid "+this.clrs[1];
	contianer.appendChild( filtercanvas );
	this.ele.push( filtercanvas );
	
	var wavecanvas = document.createElement('canvas');
	var offset = padding*2 + border*4 + margin;
		wavecanvas.width = innerWidth - filtercanvas.width - offset;
		wavecanvas.height = rowHeight;
		wavecanvas.style.position = "absolute";
		wavecanvas.style.left = leftWidth + border*2 + padding + margin + "px";
		wavecanvas.style.top = padding+"px";
		wavecanvas.style.border = border+"px solid "+this.clrs[1];
	contianer.appendChild( wavecanvas );
	this.ele.push( wavecanvas );

	var controls = document.createElement('div');
		controls.style.width = leftWidth+"px";
		controls.style.height = subHeight+"px";
		controls.style.position = "absolute";
		controls.style.left = padding+"px";
		controls.style.top = rowHeight + padding + border*2 + margin + "px";
		controls.style.border = border+"px solid "+this.clrs[1];
		controls.style.backgroundColor = "#1a1a1a";
	contianer.appendChild( controls );
	this.ele.push( controls );

	var peakcanvas = document.createElement('canvas');
	var offset = padding*2 + border*4 + margin;
		peakcanvas.width = innerWidth - leftWidth - offset;
		peakcanvas.height = subHeight;
		peakcanvas.style.border = border+"px solid "+this.clrs[1];
		peakcanvas.style.position = "absolute";
		peakcanvas.style.left = padding + leftWidth + border*2 + margin+"px";
		peakcanvas.style.top = rowHeight + padding + border*2 + margin + "px";
	contianer.appendChild( peakcanvas );
	this.ele.push( peakcanvas );

};

/* the 4 sections * * * * * * * * * * * /
 *
 *  [ drawFilterShape] [ drawWaveform        ]
 *  
 *  [ createDatGui   ] [ drawPeaks / drawBPM ]
 * 
 * * * * * * * * * * * * * * * * * * * */

BeatRipperGUI.prototype.drawFilterShape = function(){
	var canvas = this.ele[1];
	var self = this;

	BB.A2VUtils.drawFilterShape( this.BR.filt, this.ele[1],{
		stroke: self.clrs[2],
		fill: self.clrs[3]
	}); 
};

BeatRipperGUI.prototype.drawWaveform = function( chnlData ){
	
	if(typeof chnlData === "undefined")
		chnlData = this.BR.fft.getResampledBufferData( this.BR.buffer, this.ele[2].width );

	var canvas = this.ele[2];

	BB.A2VUtils.drawWaveform( chnlData, canvas,{
		color1: this.clrs[2],
		color2: this.clrs[3],
		clear: true
	});

};


BeatRipperGUI.prototype.createDatGui = function(){
	var self = this;
	var gui = new dat.GUI({autoPlace: false});  
	this.ele[3].appendChild(gui.domElement);

	var hazgain = ["lowshelf", "highshelf"]

	var transport = {
		play: function(){ 
			self.BR.track.play('file'); 
			self.updatePlayhead( true );
		},
		stop: function(){ 
			self.BR.track.node.stop();  
			self.updatePlayhead( false );
		},
		toggle: function(){
			if(self.playing) 	this.stop();
			else 				this.play();
		}
	}

	gui.add( this.BR, "process").name(this.BR.filt.node.type.toUpperCase()+' &nbsp;&nbsp;&nbsp;[ update visulizations ]');
	gui.add( this.BR.filt, 'frequency', 20, 10000 ).onChange( function(){ self.drawFilterShape(); });

	if(this.BR.type=="peaking"){
		gui.add( this.BR.filt, 'Q', 0, 20 ).onChange( function(){ self.drawFilterShape(); });
		gui.add( this.BR.filt, 'gain', -10, 10 ).onChange( function(){ self.drawFilterShape(); });
	} else if(this.BR.type=="lowshelf"||this.BR.type=="highshelf"){
		gui.add( this.BR.filt, 'gain', -10, 10 ).onChange( function(){ self.drawFilterShape(); });
	} else {
		gui.add( this.BR.filt, 'Q', 0, 30 ).onChange( function(){ self.drawFilterShape(); });
	}

	gui.add( transport, "toggle").name("PLAY / STOP");
	gui.add( this.BR, 'threshold', 0.001, 1.0 ).step(0.001);

	gui.domElement.children[1].style.display = "none"; // hide "close" button
	gui.domElement.children[0].children[0].children[0].children[0].style.width = '100%'; // display full button name
};

BeatRipperGUI.prototype.drawPeaks = function( peaks, length ) {
	var canvas = this.ele[4];
	var ctx = canvas.getContext('2d');

	if( peaks.length === 0){
	
		ctx.font = '20px Arial';
		ctx.textBaseline = 'middle';
		ctx.textAlign = "center";
		ctx.fillStyle = this.color.hex;
		ctx.fillText("click [ update visulizations ] to calculate peaks", canvas.width/2, canvas.height/2);
	
	} else {
		
		ctx.clearRect( 0, 0, canvas.width, canvas.height );
		ctx.beginPath();
		for (var p = 0; p < peaks.length; p++) {
			for (var i = 0; i < peaks[p].length; i++) {
				var x = BB.MathUtils.map( peaks[p][i], 0, length, 0, canvas.width );
				var y1 = (p+1) * 10 + (p*60);
				var y2 = y1 + 60; 
				ctx.moveTo( x, y1 );
				ctx.lineTo( x, y2 );
			};
		};
		ctx.stroke();		
	}
};

BeatRipperGUI.prototype.drawBPM = function( bpm ) {
	var canvas = this.ele[4];
	var ctx = canvas.getContext('2d');
	ctx.font = '20px Arial';
	ctx.textBaseline = 'bottom';
	ctx.textAlign = "left";
	ctx.fillStyle = this.color.hex;
	ctx.fillText('tempo: '+bpm+" BPM", 2, canvas.height-2);
};

// ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ PLAYHEAD TIMELINE  ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~


BeatRipperGUI.prototype.skipto = function( e ){
	var padding 	= this.css.padding;
	var margin 		= this.css.margin;
	var border 		= this.css.border;
	var leftWidth 	= this.css.leftWidth;
	var rowHeight 	= this.css.rowHeight;

	var t = BB.MathUtils.map( e.clientX, 0, innerWidth, 0, this.BR.buffer.duration );
	this.BR.track.node.stop();
	this.BR.track.play('file',0, t);
	this.updatePlayhead( true );
	this.xPos = e.clientX - (leftWidth + border*3 + padding + margin); 
	this.playhead.setAttribute('x1', this.xPos);
	this.playhead.setAttribute('x2', this.xPos);	
};

BeatRipperGUI.prototype.createTimeline = function(){

	var self = this;

	var padding 	= this.css.padding;
	var margin 		= this.css.margin;
	var border 		= this.css.border;
	var leftWidth 	= this.css.leftWidth;
	var rowHeight 	= this.css.rowHeight;
	var subHeight 	= this.css.subHeight;
	
	var offset = padding*2 + border*4 + margin;
	var timeline = document.createElementNS("http://www.w3.org/2000/svg", "svg");
		timeline.setAttribute( 'width', window.innerWidth - 50 );
		timeline.setAttribute('height', rowHeight + border*2 + margin + subHeight );
		timeline.style.width = innerWidth - leftWidth - offset+"px";
		timeline.style.height = rowHeight + border*2 + margin + subHeight + "px";
		timeline.style.position = "absolute";
		timeline.style.left = leftWidth + border*2 + padding + margin + "px";
		timeline.style.top = padding+"px";
		// timeline.style.border = border+"px solid "+this.clrs[1];
		timeline.style.display = "block";
		timeline.style.cursor = "pointer";
		timeline.onmousedown = function(e){ self.mousedown = true; self.skipto(e) }
		timeline.onmouseup = function(e){ self.mousedown = false; }
		timeline.onmousemove = function(e){
			if(self.mousedown) self.skipto(e);
		}
	this.ele[0].appendChild( timeline );

	this.playhead = document.createElementNS("http://www.w3.org/2000/svg", "line");
	this.playhead.setAttribute('y1','0');
	this.playhead.setAttribute('y2', rowHeight + border*2 + margin + subHeight);
	this.playhead.setAttribute('x1', 0);
	this.playhead.setAttribute('x2', 0);
	this.playhead.setAttribute('stroke',self.clrs[1]);
	this.playhead.setAttribute('stroke-width',2);
	timeline.appendChild( this.playhead );

}

BeatRipperGUI.prototype.updatePlayhead = function( condition ){ 
	var self = this;

	if(condition){
		if( this.playing ){

		} else {
			this.playing = true;
			this.time = BB.Audio.context.currentTime;
			this.loop = setInterval(function(){
				var delta = BB.Audio.context.currentTime - self.time;
				var incPerSec = self.ele[2].width / self.BR.buffer.duration;
				self.xPos += incPerSec * delta;
				self.playhead.setAttribute('x1', self.xPos);
				self.playhead.setAttribute('x2', self.xPos);
				if(self.xPos > self.ele[2].width ) self.updatePlayhead( false );
				self.time = BB.Audio.context.currentTime;
			}, 1000/60);
		}

	} else {
		this.playing = false;
		this.xPos=0; 
		self.playhead.setAttribute('x1', self.xPos);
		self.playhead.setAttribute('x2', self.xPos);
		self.time = BB.Audio.context.currentTime;
		clearInterval( self.loop );
	}

};