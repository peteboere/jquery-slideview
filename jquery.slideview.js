/*!

jQuery slideview carousel plugin

Project page: https://github.com/peteboere/jquery-slideview
License: http://www.opensource.org/licenses/mit-license.php
Copyright: (c) 2012 Pete Boere

*/
(function ($) {


// Console love
var noop = function () {};
window.console = window.console || { log: noop, warn: noop };

var warn = function ( msg ) {
	if ( slideview.DEBUG ) {
		console.warn( '$.slideview: ' + msg );
	}
};
var ie = ( !!window.ActiveXObject && +( /msie\s(\d+)/i.exec( navigator.userAgent )[1] ) ) || NaN;


var slideview = $.slideview = function ( options ) {

	if ( ! options.data || options.data.length < 2 ) {
		warn( 'slideview called with insufficient data' );
	}
	this.data = options.data;
	this.$container = $( options.container );
	if ( ! this.$container ) {
		warn( 'slideview called with no container element' );
	}
	
	this.options = options;
	
	this.$track = this.$container.find( '.slideview-track' ).first();

	this.currentIndex = options.start || 0;
}


slideview.prototype = {

	transitioning: false,

	load: function () {

		var self = this;
		var $slideMasterTemplate = self.$track.find( '.slideview-slide' ).clone();
		var $fieldElements = $slideMasterTemplate.find( '[data-slideview-field]' );
		
		// Purge template contents and attributes
		$fieldElements.each( function () {
			var $this = $( this );
			var datatype = this.getAttribute( 'data-slideview-datatype' );
			if ( datatype == 'html' ) {
				this.innerHTML = '';
			}
			else if ( datatype && datatype.indexOf( 'attr_' ) === 0 ) {
				var attr = datatype.split( '_' )[1];
				this.removeAttribute( attr );
			}
		});

		// Clear current slides
		self.$track.empty();

		self.slides = [];

		// Loop the data and insert slides
		$.each( self.data, function ( i, dataitem ) {

			if ( ! dataitem ) {
				// Internet Explorer interprets a trailing comma in arrays as an (undefined) item
				return;
			}

			// Clone a slide
			var $slide = $slideMasterTemplate.clone();

			// Loop the slide field elements
			$slide.find( '[data-slideview-field]' ).each( function ( _i, _it ) {
				var field = this.getAttribute( 'data-slideview-field' );

				var fieldData = dataitem[ field ];
				if ( fieldData ) {
					var attr = fieldData.attr;
					var value = fieldData.value;
					if ( attr ) {
						this.setAttribute( attr, value );
					}
					else {
						this.innerHTML = value;
					}
				}
			});

			self.slides.push( $slide );

			// Append the slide
			self.$track.append( $slide );
		});

		// Enable the container to recieve keyboard events
		self.$container.attr( 'tabindex', 0 );
		
		// Reset active slide position on window resize
		$( window ).resize( function () { self.resetPosition(); } );
		
		
		$( window ).focus( function () {
			if ( self.transitioning ) {
				warn( 'manual moveComplete' );
				self.moveComplete();
			}
		});
		
		
		// Fixing IE < 8
		if ( ie < 8 ) {
			self.ieFixWidths();
			$( window ).resize( function () { self.ieFixWidths(); } );
		}

		if ( self.slides.length > 1 ) {
			self.addControls();

			// Keyboard navigation
			self.$container.keydown( function ( e ) {
				var keycode = e.keyCode || e.which;
				var slideCount = self.slides.length

				// Capture number keys 0-9 (0 will be 10)
				var keyNumberZero = 48;
				var keyNumber = keycode >= keyNumberZero && keycode < ( keyNumberZero + 9 );
				var keyNumberPadZero = 96
				var keyNumberPad = keycode >= keyNumberPadZero && keycode < ( keyNumberPadZero + 9 );
				var keyRight = 39 === keycode;
				var keyLeft = 37 === keycode;
				
				var usableKey = keyNumber || keyNumberPad || keyRight || keyLeft;
				
				if ( usableKey ) {
					// Timer will need to reset if it's running
					self.resetTimed();
					e.preventDefault();
				}
				else {
					return;
				}

				if ( keyNumber ) {
					var moveTo = keycode === keyNumberZero ? 
						10 : keycode - ( keyNumberZero + 1 );
					self.move( moveTo );
				}
				if ( keyNumberPad ) {
					var moveTo = keycode === keyNumberPadZero ? 
						10 : keycode - ( keyNumberPadZero + 1 ); 
					self.move( moveTo );
				}
				else if ( keyLeft ) {
					self.previous();
				}
				else if ( keyRight ) {
					self.next();
				}
			});
		}
		
		return self;
	},
	
	ieFixWidths: function () {
		if ( ! ( ie < 8 ) ) {
			return;
		}
		var self = this;
		var slides = self.slides;
		var $track = self.$track;
		var slideCount = self.slides.length;
		
		// Reset widths
		self.$track.css( 'width', '' );
		$.each( slides, function ( i, $it ) {
			$it.css( 'width', '' );
		});
		
		// Get the natural slide width
		var slideWidth = self.getSlideWidth();
		
		// Set widths to absolute values
		self.$track.css( 'width', slideWidth * slideCount + 10 );
		$.each( slides, function ( i, $it ) {
			$it.css( 'width', slideWidth );
		});

	},

	updateControls: function () {
		var self = this;
		var $pagerLinks = self.$container.find( '.slideview-pager .slideview-numbered' );
		$pagerLinks.removeClass( 'active' ).eq( self.currentIndex ).addClass( 'active' )
	},

	buildControls: function () {

		var self = this;
		var pager = '<div class="slideview-pager">';
		var pagerLinks = [];
		
		pagerLinks.push( '<a class="slideview-previous" href="carousel:previous"><span>Previous</span></a>' );
		$.each( self.slides, function ( i, it ) {
			var position = i+1;
			pagerLinks.push( '<a class="slideview-numbered" href="carousel:' + position + '"><span>Slide ' + position + '</span></a>' );
		});
		pagerLinks.push( '<a class="slideview-next" href="carousel:next"><span>Next</span></a>' );
		
		pager += pagerLinks.join( ' ' );
		pager += '</div>';
		self.$container.append( pager );
	},


	addControls: function () {
		
		var self = this;
		
		// Build the paging controls
		if ( self.options.buildControls ) {
			self.options.buildControls.call( self );
		}
		else {
			self.buildControls();
		}

		// Add events
		var pseudoClass = 'carousel:';
		var $containerControls = $( 'a[href^="' + pseudoClass + '"]', self.$container );
		
		$containerControls.click( function () {

			var href = this.getAttribute( 'href' );

			if ( ! self.transitioning && href ) {
				
				// Timer will need to reset if it's running
				self.resetTimed();

				var arg = $.trim( href.substring( pseudoClass.length ) );
				// If an integer move to the index
				if ( +arg ) {
					self.move( arg-1 );
				}
				// Named arguments
				else if ( arg === 'next' ) {
					self.next();
				}
				else if ( arg === 'previous' ) {
					self.previous();
				}
			}
			return false;
		});
		
		// Update controls after first load
		self.updateControls();
	},

	getSlideWidth: function () {
		return this.slides[0][0].offsetWidth;
	},
	
	resetPosition: function () {
		this.slides[0].css( 'margin-left', -( this.getSlideWidth() * this.currentIndex ) );
	},

	move: function ( index ) {
		var self = this;
		
		// Bail-out scenarios
		var invalidIndex = index < 0 || index > self.slides.length-1;
		var calledCurrentIndex = self.currentIndex === index;
		var inTransition = self.transitioning;
		
		if ( inTransition || calledCurrentIndex || invalidIndex ) {
			
			invalidIndex && warn( 'Invalid index passed: ' + index );
			inTransition && warn( 'in transition' );
			calledCurrentIndex && warn( 'Called current index' );
			
			return;
		}
		self.pendingIndex = index;
		self.transitioning = true;
		self.slides[0].transition({
				'margin-left': -( self.getSlideWidth() * index )
			}, 
			self.options.speed || 250, 
			{ transition: 'ease-in-out', animate: 'swing' }, 
			function () {
				self.moveComplete();
			});
	},

	moveComplete: function () {
		var self = this;
		self.transitioning = false;
		self.currentIndex = self.pendingIndex;
		self.updateControls();
	},

	next: function () {
		var self = this;
		var lastIndex = self.slides.length-1;
		var loop = self.options.loop;
		
		if ( self.currentIndex === lastIndex ) {
			if ( loop ) {
				self.move( 0 );
			}
		}
		else {
			self.move( self.currentIndex + 1 );
		}
	},
	
	previous: function () {
		var self = this;
		var lastIndex = self.slides.length-1;
		var loop = self.options.loop;

		if ( self.currentIndex === 0 ) {
			if ( loop ) {
				self.move( lastIndex );
			}
		}
		else {
			self.move( self.currentIndex - 1 );
		}
	},


	timerId: null,
	
	startTimed: function ( timeInterval ) {
		var self = this;

		if ( ! self.options.loop || self.slides.length < 2 ) {
			return;
		}
		// Remove previous timer (if set)
		self.cancelTimed();
		
		// Get the timer interval
		self.timerInterval = typeof timeInterval !== 'undefined' ? timeInterval : 7000;
		
		function go () {
			self.timerId = setTimeout( loop, timeInterval );
		}
		
		function loop () {
			self.next();
			go();
		}
		go();
	},
	
	cancelTimed: function () {
		clearTimeout( this.timerId );
		this.timerId = null;
	},
	
	resetTimed: function () {
		if ( this.timerId !== null ) {
			this.startTimed( this.timerInterval );
		}
	}

};


})(jQuery);
