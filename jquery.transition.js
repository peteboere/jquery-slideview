/*!

jQuery CSS transition plugin

Project page: https://github.com/peteboere/jquery-transition
License: http://www.opensource.org/licenses/mit-license.php
Copyright: (c) 2012 Pete Boere

*/
(function ( $ ) {

	var each = $.each,

		capitalize = function ( str ) {
			return str.charAt(0).toUpperCase() + str.substring(1);
		},

		camelize = function ( str ) {
			if ( str.indexOf( '-' ) === -1 ) {
				return str;
			}
			var parts = str.split( '-' ),
				out = parts.shift();
			each( parts, function ( i, it ) {
				out += capitalize( it );
			});
			return out;
		},

		isset = function ( value ) {
		    return typeof value !== 'undefined' && value !== null;
		},

		testElem = document.createElement( 'meh' ),
		$testElem = $( testElem ),

		// Get vendor specific CSS property names (if any needed)
		getVendorStyleProperty = function ( property ) {

			// Cache onto the function itself
			var self = getVendorStyleProperty,
				// Normalize the propery string to camelCase
				property = camelize( property );
	
			self.c = self.c || {};

			if ( property in self.c ) {
				return self.c[ property ];
			}

			var testElemStyle = testElem.style;

			if ( property in testElemStyle ) {
				self.c[ property ] = property;
				return property;
			}
			else {
				var prefixes = 'Webkit Moz O ms Khtml'.split( ' ' ),
					propertyCap = capitalize( property ),
					i = 0, 
					test;
				for ( ; i < prefixes.length; i++ ) {
					test = prefixes[i] + propertyCap;
					if ( test in testElemStyle ) {
						self.c[ property ] = test;
						// Store the prefixed value to jQuery cssProps
						$.cssProps[ property ] = test; 
						return test; 
					}
				}
			}
			self.c[ property ] = null;
			return null;
		},

		// Detect for transition events
		// https://developer.mozilla.org/en/CSS/CSS_transitions
		transitionProperty = getVendorStyleProperty( 'transition' ),
		
		transitionEndEvents = {
			'transition'       : 'transitionend',
			'WebkitTransition' : 'webkitTransitionEnd',
			'MozTransition'    : 'transitionend',
			'OTransition'      : 'oTransitionEnd',
			'msTransition'     : 'MSTransitionEnd'
		},
		
		transitionEndEvent = transitionProperty && transitionEndEvents[ transitionProperty ],

		// Console love
		noop = function () {},
		console = window.console || { log: noop, warn: noop },
		
		warnMsg = function ( msg ) {
			if ( plugin.DEBUG ) {
				console.warn( '$.fn.transition: ' + msg );
			}
		};


var plugin = $.fn.transition = function ( map, duration, easing, callback ) {
	
	var self = this,
		filteredSelf;
	
	// Normalize easing:
	//   2 paths since CSS transitions support various easing functions whereas 
	//   jQuery has only 'linear' and 'swing' in core.
	//   If no easing is named both methods fall back on their respective defaults
	var transitionEasing = isset( easing ) ? easing : '',
		animateEasing = easing;

	// Optionally pass specific easing functions to either path
	if ( easing && $.isPlainObject( easing ) ) {
		transitionEasing = easing.transition || '';
		animateEasing = easing.animate;
	}

	// Normalize the property/value map:
	//   Also works around vendor prefixing for jQuery.animate()
	var filteredMap = {};

	each( map, function ( property, value ) {
		var _property = getVendorStyleProperty( property ),
			_value = value;
		// If the value is a number, but not a 'cssNumber' append 'px' 
		if ( typeof value === 'number' && ! $.cssNumber[ _property ] ) {
			_value += 'px';
		}
		// If the value is not a 'cssNumber' pass it through jQuery.css()
		else if ( ! $.cssNumber[ _property ] ) {
			_value = $testElem.css( _property, value ).css( _property );
		}
		filteredMap[ _property ] = _value;
	});

	// Filter elements down to those that actually need to be transitioned:
	//   The endEvent will never fire on an element if no CSS value is changed 
	//   so we filter elements to those that are actually have style changes.
	//   The downside with this potential edge case is the 'complete' callback
	//   will not fire as it would with jQuery.animate().
	filteredSelf = self.filter( function () {
		var result = false,
			elStyle = this.style,
			$el = $( this ),
			property,
			value;
		for ( property in filteredMap ) {
			value = filteredMap[ property ];
			if ( 
				elStyle[ property ] !== value && 
				$el.css( property ) !== value
			) {
				result = true;
				break;
			}
		}
		return result;
	});

	// Return early if empty after filtering
	if ( filteredSelf.length < 1 ) {
		// console.log('early exit');
		return self;
	}

	// Early exit for clients that don't support css transitions; falls back to jQuery.animate()
	if ( ! transitionEndEvent ) {
		filteredSelf.animate( map, duration, animateEasing, callback );
		return self;
	}

	// Get a duration time in ms:
	//   Use jQuery fx keywords and default values if needed
	var speeds = $.fx.speeds,
		_default = speeds._default,
		_duration = isset( duration ) ? duration : _default;
	if ( typeof duration == 'string' ) {
		_duration = speeds[ duration ] || _default;
	}

	// If duration is 0 or resolves falsy just set the values, execute callback and return
	if ( ! _duration ) {
		filteredSelf.css( filteredMap ).each( function () {
			callback && callback.call( this );
		});
		return self;
	}

		// Cache the transition value outside the loop 
	var transitionValue = [ _duration + 'ms', transitionEasing ].join( ' ' ),
		// Namespace the transitionEnd event
		nsTransitionEndEvent = transitionEndEvent + '.transition';

	// Apply the transition to the collection
	filteredSelf.each( function () {

		var el = this,
			$el = $( this ),
			style = el.style,

			// We need a fallback timer to invoke 'done' incase the
			// transitionEnd event never fires for some reason
			doneDone = false,
			fallbackTimer = null,

			done = function () {
				// Clear the fallback timeout, and flag the callback as being complete
				// in-case transitionEnd decides to fire after the fallback timeout
				clearTimeout( fallbackTimer );
				if ( doneDone ) { return; }
				doneDone = true;
				
				// Unset the transition property and remove the endEvent listener
				$el.unbind( nsTransitionEndEvent );
				style[ transitionProperty ] = '';

				// Like jQuery.animate() callback fires once for every element
				// Apply the callback bound to the element 
				callback && callback.call( el );
			};

		// Set the transition property and add the endEvent listener
		$el.bind( nsTransitionEndEvent, done );
		style[ transitionProperty ] = transitionValue;

		// Set the values
		each( filteredMap, function ( property, value ) {
			style[ property ] = value;
		});
		
		// Set the fallback timer, add delay to give transitionEnd event the best chance to fire first
		fallbackTimer = setTimeout( function () {
			warnMsg( 'Used fallback timer' );
			done();
		}, _duration + 40 );
	});

	return self;
};

// Make end event and vendor property detection available for external re-use
plugin.transitionEndEvent = transitionEndEvent;
plugin.getVendorStyleProperty = getVendorStyleProperty;


})( jQuery );