"use strict";

	function memsetlaurent_u8(data,offset,length,value)
	{
		var start = (offset);
		for (var i = 0; i < length; i++) {
			data[start] = value;
			start++;
		}
	}

	export function BlobExtractionLaurent_u8(label,data, w, h) {
		//console.log('blob');
		var max = w * h;
		//alert(max);

		//These are constants
		var BACKGROUND = 0;
		var FOREGROUND = 255;
		var UNSET      = 0;
		var MARKED     = -1;

		/*
		 * 5 6 7
		 * 4 P 0
		 * 3 2 1
		 */
		var pos = [1, w + 1, w, w -1, -1, -w -1, -w, -w+1]; // Clockwise

		//var label = new Array(); // Same size as data
		var c = 1;      // Component index

		// We change the border to be white. We could add a pixel around
		// but we are lazy and want to do this in place.
		// Set the outer rows/cols to min
		memsetlaurent_u8(data,0,w,FOREGROUND);
		memsetlaurent_u8(data,w*(h-1),w,FOREGROUND);

		var offset = w;
		for (var y = 1; y < h-1; y++) {
			//var offset = y * w;
			data[((offset        ))] = FOREGROUND; // Left
			data[((offset + w - 1))] = FOREGROUND; // Right
			offset += w;
		}

		var tracer = function(S, p) {

			for (var d = 0; d < 8; d++) {
				var q = (p + d) % 8;

				var T = S + pos[q];

				// Make sure we are inside image
				if (T < 0 || T >= max)
					continue;

				if (data[(T)] !== BACKGROUND)
					return {T:T, q:q};

				//assert(label[T] <= UNSET,'label[T]<UNSET');
				//if (label[T] <= UNSET)
				//	console.log('unset');
				label[T] = MARKED;
			}

			// No move
			return {T:S, q:-1};
		};

		/**
		 * 
		 * @param S Offset of starting point
		 * @param C label count
		 * @param external Boolean Is this internal or external tracing
		 */
		var contourTracing = function (S, C, external) {
			var p = external ? 7 : 3;

			// Find out our default next pos (from S)
			var tmp = tracer(S, p); 
			var T2 = tmp.T;
			var q  = tmp.q;

			label[S] = C;

			// Single pixel check
			if (T2 === S)
				return;

			var counter = 0;

			var Tnext   = T2;
			var T       = T2;

			while ( T !== S || Tnext !== T2 ) {
				//assert(counter++ < max, "Looped too many times!");

				label[Tnext] = C;

				T = Tnext;
				p = (q + 5) % 8;

				tmp = tracer(T, p);
				Tnext = tmp.T;
				q     = tmp.q;
			}
		};

		var extract = function() {

			var y = 1; // We start at 1 to avoid looking above the image
			do {
				var x = 0;
				do {
					var offset = y * w + x;

					// We skip white pixels or previous labeled pixels
					if (data[(offset)] === BACKGROUND)
						continue;

					var traced = false;

					// Step 1 - P not labelled, and above pixel is white
					if (data[((offset - w))] === BACKGROUND && label[offset] === UNSET) {
						//console.log(x + "," + y + " step 1");

						// P must be external contour
						contourTracing(offset, c, true);
						c++;

						traced = true;
					}

					// Step 2 - Below pixel is white, and unmarked
					if (data[((offset + w))] === BACKGROUND && label[offset + w] === UNSET) {
						//console.log(x + "," + y + " step 2");

						// Use previous pixel label, unless this is already labelled
						var n = label[offset - 1];
						if (label[offset] !== UNSET)
							n = label[offset];

						//assert( n > UNSET, "Step 2: N must be set, (" + x + "," + y + ") " + n + " " + data[(offset - 1)<<2]);

						// P must be a internal contour
						contourTracing(offset, n, false);

						traced = true;
					}

					// Step 3 - Not dealt with in previous two steps
					if (label[offset] === UNSET) {
						//console.log(x + "," + y + " step 3");
						//console.log2D(label, w, h);
						var n = label[offset - 1];

						//assert(!traced, "Step 3: We have traced, but not set the label");
						//assert( n > UNSET, "Step 3: N must be set, (" + x + "," + y + ") " + n);

						// Assign P the value of N
						label[offset] = n;
					}
				} while (x++ < w);
			} while (y++ < (h-1)); // We end one before the end to to avoid looking below the image

			//console.log("labels=" + c);
			return label;
		};

		return extract();
	}
	/**
	 * Returns an array of each blob's bounds
	 * TODO do this with the BlobExtraction stage
	 * @param label
	 * @param width
	 * @param height
	 */

	export function BlobBounds_u8(label, width, height) {
		var blob = {};
		var offset = 0;
		for (var y = 0; y < height; y++) {
			for (var x = 0; x < width; x++) {
				var l = label[offset++];

				if (l <= 0)
				{
					//debug('l<=0 for ' + x + ',' + y);
					continue;
				}

				//if (l in blob)
				if (blob[l])
				{
					var b = blob[l];

					if (b.x2 < x)
						b.x2 = x;

					if (b.x1 > x)
						b.x1 = x;

					// As we are going from top down, the bottom y should increase
					b.y2 = y;

					//blob[l] = b;
				} else {
					blob[l] = {l:l, x1:x, y1:y, x2:x, y2:y};
				}
			}
		}

		var res = [];
		for (var b in blob)
			res.push(blob[b]);
		return res;
	}


/*function assert(exp, message) {
	if (!exp) {
        console.error('assert connected components:'+message);
	}
}*/



function memsetlaurent(data,offset,length,value)
{
    var start = (offset<<2);
    for (var i = 0; i < length; i++) {
		data[start] = value;
        start += 4;
	}
}

/**
 * Connected-component labeling (aka blob extraction)
 * Using Algorithm developed in "A linear-time component labeling algorithm using contour tracing technique"
 * @param data
 * @param width
 * @param height
 * @returns {BlobExtraction}
 */
function BlobExtractionLaurent(label,data, w, h) {
    //console.log('blob');
	var max = w * h;
    //alert(max);

	//These are constants
	var BACKGROUND = 0;
	var FOREGROUND = 255;
	var UNSET      = 0;
	var MARKED     = -1;

	/*
	 * 5 6 7
	 * 4 P 0
	 * 3 2 1
	 */
	var pos = [1, w + 1, w, w -1, -1, -w -1, -w, -w+1]; // Clockwise

	//var label = new Array(); // Same size as data
	var c = 1;      // Component index

	// We change the border to be white. We could add a pixel around
	// but we are lazy and want to do this in place.
	// Set the outer rows/cols to min
  /*memsetlaurent(data,0,w,FOREGROUND);
  memsetlaurent(data,w*(h-1),w,FOREGROUND);

    var offset = w;
	for (var y = 1; y < h-1; y++) {
		//var offset = y * w;
		data[((offset        )<<2)] = FOREGROUND; // Left
		data[((offset + w - 1)<<2)] = FOREGROUND; // Right
        offset += w;
	}*/
    //alert(label.length);
	// Set labels to zeros
    // TODO: pass label as parameter so we can reuse the array
	//label.memset(0, max, UNSET);
    //console.log('here with max='+max);
    //var buf = new ArrayBuffer(max);
    //console.log('buf=' + buf);
    //var label = new Uint8ClampedArray(buf);
    //console.log('label=' + label);
    //label = new ArrayBuffer(max);

	var tracer = function(S, p) {

		for (var d = 0; d < 8; d++) {
			var q = (p + d) % 8;

			var T = S + pos[q];

			// Make sure we are inside image
			if (T < 0 || T >= max)
				continue;

			if (data[(T<<2)] !== BACKGROUND)
				return {T:T, q:q};

			//assert(label[T] <= UNSET,'label[T]<UNSET');
			//if (label[T] <= UNSET)
			//	console.log('unset');
			label[T] = MARKED;
		}

		// No move
		return {T:S, q:-1};
	};

	/**
	 * 
	 * @param S Offset of starting point
	 * @param C label count
	 * @param external Boolean Is this internal or external tracing
	 */
	var contourTracing = function (S, C, external) {
		var p = external ? 7 : 3;

		// Find out our default next pos (from S)
		var tmp = tracer(S, p); 
		var T2 = tmp.T;
		var q  = tmp.q;

		label[S] = C;

		// Single pixel check
		if (T2 === S)
			return;

		var counter = 0;

		var Tnext   = T2;
		var T       = T2;

		while ( T !== S || Tnext !== T2 ) {
			//assert(counter++ < max, "Looped too many times!");

			label[Tnext] = C;

			T = Tnext;
			p = (q + 5) % 8;

			tmp = tracer(T, p);
			Tnext = tmp.T;
			q     = tmp.q;
		}
	};

	var extract = function() {

		var y = 1; // We start at 1 to avoid looking above the image
		do {
			var x = 0;
			do {
				var offset = y * w + x;

				// We skip white pixels or previous labeled pixels
				if (data[(offset<<2)] === BACKGROUND)
					continue;

				var traced = false;

				// Step 1 - P not labelled, and above pixel is white
				if (data[((offset - w)<<2)] === BACKGROUND && label[offset] === UNSET) {
					//console.log(x + "," + y + " step 1");

					// P must be external contour
					contourTracing(offset, c, true);
					c++;

					traced = true;
				}

				// Step 2 - Below pixel is white, and unmarked
				if (data[((offset + w)<<2)] === BACKGROUND && label[offset + w] === UNSET) {
					//console.log(x + "," + y + " step 2");

					// Use previous pixel label, unless this is already labelled
					var n = label[offset - 1];
					if (label[offset] !== UNSET)
						n = label[offset];

					//assert( n > UNSET, "Step 2: N must be set, (" + x + "," + y + ") " + n + " " + data[(offset - 1)<<2]);

					// P must be a internal contour
					contourTracing(offset, n, false);

					traced = true;
				}

				// Step 3 - Not dealt with in previous two steps
				if (label[offset] === UNSET) {
					//console.log(x + "," + y + " step 3");
					//console.log2D(label, w, h);
					var n = label[offset - 1];

					//assert(!traced, "Step 3: We have traced, but not set the label");
					//assert( n > UNSET, "Step 3: N must be set, (" + x + "," + y + ") " + n);

					// Assign P the value of N
					label[offset] = n;
				}
			} while (x++ < w);
		} while (y++ < (h-1)); // We end one before the end to to avoid looking below the image

		//console.log("labels=" + c);
		return label;
	};

	return extract();
}

/**
 * Returns an array of each blob's bounds
 * TODO do this with the BlobExtraction stage
 * @param label
 * @param width
 * @param height
 */

function BlobBounds(label, width, height) {
	var blob = {};
	var offset = 0;
	for (var y = 0; y < height; y++) {
		for (var x = 0; x < width; x++) {
			var l = label[offset++];

			if (l <= 0)
            {
                //debug('l<=0 for ' + x + ',' + y);
				continue;
            }

			//if (l in blob)
			if (blob[l])
			{
				var b = blob[l];

				if (b.x2 < x)
					b.x2 = x;

				if (b.x1 > x)
					b.x1 = x;

				// As we are going from top down, the bottom y should increase
				b.y2 = y;

				//blob[l] = b;
			} else {
				blob[l] = {l:l, x1:x, y1:y, x2:x, y2:y};
			}
		}
	}

	var res = [];
	for (var b in blob)
		res.push(blob[b]);
	return res;
}
