/* JavaScript Turing machine emulator */
/* Anthony Morphett - awmorp@gmail.com */
/* May 2008 */

/* Updated May 2012.  Added 'full speed' mode. */
/* Bugfix June 2012 */
/* Updated April 2013. Made states and tape symbols case-sensitive. */

/* TODO:
    * cooler head icon
    * click-to-edit tape, program
    * runtime messages shown in top area between state, steps
    * test on IE, linux browsers
    * nicer CSS
*/

var g_nDebugLevel = 0;

var bFullSpeed = false;   /* If true, run at full speed with no delay between steps */

var sTape = "0110110";
var nHeadPosition = 0;   /* the position of the TM's head on its tape. Initially zero; may be negative if TM moves to left */
var sState = "0";
var nTapeOffset = 0;     /* the logical position on TM tape of the first character of sTape */
var nSteps = 0;
var hRunTimer = null;
var hTapeTimer = null;
var aProgram = new Object();
/* aProgram is a double asociative array, indexed first by state then by symbol.
   Its members are objects with properties newSymbol, action, newState and sourceLineNumber.
*/


/* Step(): run the Turing machine for one step. Returns false if the machine is in halt state at the end of the step, true otherwise. */
function Step()
{
	if( sState == "halt" ) {
		debug( 1, "Warning: Step() called while in halt state" );
		UpdateStatusMessage( "Halted." );
		return( false );
	}
	
	var sNewState, sNewSymbol, nAction, nLineNumber;
	
	/* Find current symbol (may not be in sTape as sTape only stores modified tape cells) */
	var sHeadSymbol = GetTapeSymbol( nHeadPosition - nTapeOffset );
	if( sHeadSymbol == " " ) sHeadSymbol = "_";
	
	/* Find appropriate TM instruction */
	var oInstruction = null;
	if( aProgram[sState] != null && aProgram[sState][sHeadSymbol] != null ) {
		/* Use instruction specifically corresponding to current state & symbol, if any */
		oInstruction = aProgram[sState][sHeadSymbol];
	} else if( aProgram[sState] != null && aProgram[sState]["*"] != null ) {
		/* Next use rule for the current state and default symbol, if any */
		oInstruction = aProgram[sState]["*"];
	} else if( aProgram["*"] != null && aProgram["*"][sHeadSymbol] != null ) {
		/* Next use rule for default state and current symbol, if any */
		oInstruction = aProgram["*"][sHeadSymbol];
	} else if( aProgram["*"] != null && aProgram["*"]["*"] != null ) {
		/* Finally use rule for default state and default symbol */
		oInstruction = aProgram["*"]["*"];
	} /* else oInstruction = null; */

	if( oInstruction != null ) {
		sNewState = (oInstruction.newState == "*" ? sState : oInstruction.newState);
		sNewSymbol = (oInstruction.newSymbol == "*" ? sHeadSymbol : oInstruction.newSymbol);
		nAction = ((oInstruction.action.toLowerCase() == "r" || oInstruction.action == ">") ? 1 : 
			((oInstruction.action.toLowerCase() == "l" || oInstruction.action == ">") ? -1 : 0));
		nLineNumber = oInstruction.sourceLineNumber;
	} else {
		/* No matching rule found; halt */
		debug( 1, "Warning: no instruction found for state '" + sState + "' symbol '" + sHeadSymbol + "'; halting" );
		UpdateStatusMessage( "No rule found for state '" + sState + "', symbol '" + sHeadSymbol + "'. Halted." );
		sNewState = "halt";
		sNewSymbol = sHeadSymbol;
		nAction = 0;
		nLineNumber = -1;
	}
	
	/* Update machine tape & state */
	SetTapeSymbol( nHeadPosition, sNewSymbol );
	sState = sNewState;
	nHeadPosition += nAction;
	
	nSteps++;
	
	debug( 4, "Step() finished. New tape: '" + sTape + "'  new state: '" + sState + "'  action: " + nAction + "  line number: " + nLineNumber  );
	UpdateInterface();
	
	if( sNewState == "halt" ) {
		if( oInstruction != null ) {
			UpdateStatusMessage( "Halted." );
		} 
		EnableButtons( false, false, false, true, true );
		return( false );
	} else return( true );
}


/* Run(): run the TM until it halts or until user interrupts it */
function Run()
{
  var bContinue = true;
  if( bFullSpeed ) {
    /* Run 25 steps at a time in fast mode */
    for( var i = 0; bContinue && i < 25; i++ ) {
      bContinue = Step();
    }
    if( bContinue ) hRunTimer = window.setTimeout( Run, 10 );
    else UpdateInterface();   /* Sometimes updates get lost at full speed... */
  } else {
    /* Run a single step every 50ms in slow mode */
    if( Step() ) {
      hRunTimer = window.setTimeout( Run, 50 );
    }
  }
}

/* RunStep(): triggered by the run timer. Calls Step(); stops running if Step() returns false. */
function RunStep()
{
	if( !Step() ) {
		StopTimer();
	}
}

/* StopTimer(): Deactivate the run timer. */
function StopTimer()
{
	if( hRunTimer != null ) {
		window.clearInterval( hRunTimer );
		hRunTimer = null;
	}
}


/* Reset( sInitialTape ): restore the TM state etc to its initial value and load the tape with sInitialTape */
function Reset( sInitialTape )
{
	if( sInitialTape == null ) sInitialTape = "";
	sTape = sInitialTape;
	nSteps = 0;
	nHeadPosition = 0;
	nTapeOffset = 0;
	sState = "0";
	
	Compile( document.getElementById('ProgramSource').value );
	
	UpdateInterface();
}


/* GetTapeSymbol( n ): returns the symbol at cell n of the TM tape */
function GetTapeSymbol( n )
{
	if( n >= sTape.length || n < 0 ) {
		return( "_" );
	} else {
		var c = sTape.charAt( n );
		if( c == " " ) { c = "_"; debug( 4, "GetTapeSymbol() got SPACE not _ !!!" ); }
		return( c );
	}
}

/* SetTapeSymbol( n, c ): writes symbol c to cell n of the TM tape */
function SetTapeSymbol( nPos, c )
{
	var n = nPos - nTapeOffset;
	debug( 4, "SetTapeSymbol( " + nPos + ", " + c + " ); n = " + n + "; nTapeOffset = " + nTapeOffset );
	if( c == " " ) { c = "_"; debug( 4, "SetTapeSymbol() with SPACE not _ !!!" ); }
	if( n >= 0 && n < sTape.length ) {
		sTape = sTape.substr( 0, n ) + c + sTape.substr( n + 1 );
		debug( 5, "  n >= 0 && n < sTape.length; sTape = '" + sTape + "'" );
	} else if( n < 0 && c != "_" ) {
		sTape = c + repeat( "_", -1 - n ) + sTape;
		nTapeOffset += n;
		debug( 5, "  n < 0 && c != '_'; sTape = '" + sTape + "'  nTapeOffset = " + nTapeOffset );
	} else if( c != "_" ) { /* n >= sTape.length */
		sTape = sTape + repeat( "_", n - sTape.length ) + c;
		debug( 5, " c != ' ' && n >= sTape.length; sTape = '" + sTape + "'" );
	}
}

/* GetTapeLeft( n ): returns the non-blank portion of the tape to the left of cell n. Used by RenderTape(). */
function GetTapeLeft( n )
{
	/* TODO */
}

/* GetTapeRight( n ): returns the non-blank portion of the tape to the right of cell n. Used by RenderTape(). */
function GetTapeRight( n )
{
	/* TODO */
}

/* RenderTape(): show the tape contents and head position in the MachineTape div */
function RenderTape()
{
	/* Construct a DOM element displaying the tape contents and head position */
	oTmp = document.getElementById( "MachineTape" );
	/* Erase old tape */
	while( oTmp.hasChildNodes() ) {
		oTmp.removeChild( oTmp.firstChild );
	}
	
	/* calculate the strings:
	  sFirstPart is the portion of the tape to the left of the head
	  sHeadSymbol is the symbol under the head
	  sSecondPart is the portion of the tape to the right of the head
	*/
	var nTranslatedHeadPosition = nHeadPosition - nTapeOffset;  /* position of the head relative to sTape */
	var sFirstPart, sHeadSymbol, sSecondPart;
	debug( 4, "translated head pos: " + nTranslatedHeadPosition + "  head pos: " + nHeadPosition + "  tape offset: " + nTapeOffset );
	debug( 4, "sTape = '" + sTape + "'" );

	if( nTranslatedHeadPosition > 0 ) {
		sFirstPart = sTape.substr( 0, nTranslatedHeadPosition );
	} else {
		sFirstPart = "";
	}
	if( nTranslatedHeadPosition > sTape.length ) {  /* need to append blanks to sFirstPart */
		sFirstPart += repeat( " ", nTranslatedHeadPosition - sTape.length );
	}
	sFirstPart = sFirstPart.replace( /_/g, " " );
	
	if( nTranslatedHeadPosition >= 0 && nTranslatedHeadPosition < sTape.length ) {
		sHeadSymbol = sTape.charAt( nTranslatedHeadPosition );
	} else {
		sHeadSymbol = " ";
	}
	sHeadSymbol = sHeadSymbol.replace( /_/g, " " );
	
	if( nTranslatedHeadPosition >= 0 && nTranslatedHeadPosition < sTape.length - 1 ) {
		sSecondPart = sTape.substr( nTranslatedHeadPosition + 1 );
	} else if( nTranslatedHeadPosition < 0 ) {  /* need to prepend blanks to sSecondPart */
		sSecondPart = repeat( " ", -nTranslatedHeadPosition - 1 ) + sTape;
	} else {  /* nTranslatedHeadPosition > sTape.length */
		sSecondPart = "";
	}
	sSecondPart = sSecondPart.replace( /_/g, " " );
	
	debug( 4, "RenderTape(): sFirstPart = '" + sFirstPart + "' sHeadSymbol = '" + sHeadSymbol + "'  sSecondPart = '" + sSecondPart + "'" );
	
	/* add the various parts to the tape div */
	oTmp.appendChild( document.createTextNode( sFirstPart ) );
	
	var oHead = document.createElement( "span" );
	oHead.className = "TapeHeadSymbol";
	oHead.appendChild( document.createTextNode( sHeadSymbol ) );
	oTmp.appendChild( oHead );
	/* TODO: more sophisticated head icon */
	
	oTmp.appendChild( document.createTextNode( sSecondPart ) );
}

function RenderState()
{
	var oTmp = document.getElementById( "MachineState" );
	/* delete old content */
	while( oTmp.hasChildNodes() ) oTmp.removeChild( oTmp.firstChild );
	
	oTmp.appendChild( document.createTextNode( sState ) );
}

function RenderSteps()
{
	var oTmp = document.getElementById( "MachineSteps" );
	/* delete old content */
	while( oTmp.hasChildNodes() ) oTmp.removeChild( oTmp.firstChild );
	
	oTmp.appendChild( document.createTextNode( nSteps ) );
}

/* UpdateStatusMessage( sString ): display sString in the status message area */
function UpdateStatusMessage( sString )
{
	oTmp = document.getElementById( "MachineStatusMessagesContainer" );
	while( oTmp.hasChildNodes() ) oTmp.removeChild( oTmp.firstChild );
	
	oTmp.appendChild( document.createTextNode( sString ) );
}

/* UpdateInterface(): refresh the tape, state and steps displayed on the page */
function UpdateInterface()
{
	RenderTape();
	RenderState();
	RenderSteps();
}


/* Compile(): parse the inputted program and store it in aProgram */
function Compile( sSource )
{
	debug( 5, "Compile( " + sSource + " )" );
	/* clear the old program */
	aProgram = new Object;
	
	sSource = sSource.replace( /\r/g, "" );	/* Internet Explorer uses \n\r, other browsers use \n */
	
	var aLines = sSource.split("\n");
	for( var i in aLines ) {
	
		var oTuple = ParseLine( aLines[i], i );
		if( oTuple != null ) {
			debug( 5, " Parsed tuple: '" + oTuple.currentState + "'  '" + oTuple.currentSymbol + "'  '" + oTuple.newSymbol + "'  '" + oTuple.action + "'  '" + oTuple.newState + "'" );
			if( aProgram[oTuple.currentState] == null ) aProgram[oTuple.currentState] = new Object;
			if( aProgram[oTuple.currentState][oTuple.currentSymbol] != null ) {
				debug( 0, "Warning: multiple definitions for state '" + oTuple.currentState + "' symbol '" + oTuple.currentSymbol + "' on lines " + aProgram[oTuple.currentState][oTuple.currentSymbol].sourceLineNumber + " and " + i );
			}
			aProgram[oTuple.currentState][oTuple.currentSymbol] = new Object;
			aProgram[oTuple.currentState][oTuple.currentSymbol].newSymbol = oTuple.newSymbol;
			aProgram[oTuple.currentState][oTuple.currentSymbol].action = oTuple.action;
			aProgram[oTuple.currentState][oTuple.currentSymbol].newState = oTuple.newState;
			aProgram[oTuple.currentState][oTuple.currentSymbol].sourceLineNumber = i;
		}

	}
}

function ParseLine( sLine, nLineNum )
{
	/* discard anything following ';' */
	debug( 5, "ParseLine( " + sLine + " )" );
	sLine = sLine.split( ";", 1 )[0];

	/* split into tokens - separated by tab or space */
	var aTokens = sLine.split(/[ \t]+/);
	debug( 5, " aTokens.length: " + aTokens.length );
/*	for( var j in aTokens ) {
		debug( 1, "  aTokens[ " + j + " ] = '" + aTokens[j] + "'" );
	}
*/
	if( aTokens.length > 0 && aTokens.length < 5 ) {
		return( null );
		debug( 2, "Syntax error on line " + nLineNum + "   '" + sLine + "'" );
	}
	if( aTokens[0].length == 0 || aTokens[1].length == 0 || aTokens[2].length == 0 || aTokens[3].length ==0 || aTokens[4].length == 0 ) {
		return( null );
		debug( 2, "Syntax error on line " + nLineNum + "   '" + sLine + "'" );
	}
	
	/* parse tokens */
	var oTuple = new Object;
	oTuple.currentState = aTokens[0];
	oTuple.currentSymbol = aTokens[1].charAt( 0 );
	oTuple.newSymbol = aTokens[2].charAt( 0 );
	oTuple.action = aTokens[3].charAt( 0 );
	oTuple.newState = aTokens[4];
	return( oTuple );
}

/* return a string of n copies of c */
function repeat( c, n )
{
	var sTmp = "";
	while( n-- > 0 ) sTmp += c;
	return sTmp;
}


function debug( n, str )
{
	if( n <= 0 ) {
		UpdateStatusMessage( str );
	}
	if( g_nDebugLevel >= n  ) {
		var oDebug = document.getElementById( "debug" );
		if( oDebug ) {
			var oNode = document.createElement( 'pre' );
			oNode.appendChild( document.createTextNode( str ) );
			oDebug.appendChild( oNode );
		}
	}
}

function ClearDebug()
{
	var oDebug = document.getElementById( "debug" );
	while( oDebug.hasChildNodes() ) {
		oDebug.removeChild( oDebug.firstChild );
	}
}

function EnableButtons( bStep, bRun, bStop, bReset, bSpeed )
{
  document.getElementById( 'StepButton' ).disabled = !bStep;
  document.getElementById( 'RunButton' ).disabled = !bRun;
  document.getElementById( 'StopButton' ).disabled = !bStop;
  document.getElementById( 'ResetButton' ).disabled = !bReset;
  document.getElementById( 'SpeedCheckbox' ).disabled = !bSpeed;
}

/* Trigger functions for the buttons */

function StepButton()
{
	UpdateStatusMessage( " " );
	Step();
	stopBlink();
}

function RunButton()
{
	UpdateStatusMessage( "Running..." );
	/* Make sure that the step interval is up-to-date */
  SpeedCheckbox();
	EnableButtons( false, false, true, false, false );
	Run();
	stopBlink();
}

function StopButton()
{
	if( hRunTimer != null ) {
		UpdateStatusMessage( "Paused; click 'Run' or 'Step' to resume." );
		EnableButtons( true, true, false, true, true );
		StopTimer();
	}
	stopBlink()
}

function ResetButton()
{
	UpdateStatusMessage( "Machine reset." );
	Reset( document.getElementById( 'InitialInput' ).value );
	EnableButtons( true, true, false, true, true );
	stopBlink();
}

function SpeedCheckbox()
{
  bFullSpeed = document.getElementById( 'SpeedCheckbox' ).checked;
}

function LoadProgram( zName, bResetWhenLoaded )
{
	debug( 1, "Load '" + zName + "'" );
	var zFileName = zName + ".txt";
	var oRequest = new XMLHttpRequest();
	oRequest.onreadystatechange = function()
	{
		if( oRequest.readyState == 4 ) {
			document.getElementById( "ProgramSource" ).value = oRequest.responseText;
			Compile( document.getElementById('ProgramSource').value );
			
			/* Load the default initial tape, if any */
			var oRegExp = new RegExp( ";.*\\$INITIAL_TAPE:? *(.+)$");
			var aResult = oRegExp.exec( oRequest.responseText );
			debug( 2, "Regexp matched: '" + aResult + "' length: " + (aResult == null ? "null" : aResult.length) );
			if( aResult != null && aResult.length >= 2 ) {
				document.getElementById( "InitialInput" ).value = aResult[1];
			}
			
			/* Reset the machine to load the new tape, etc, if required */
			/* This is necessary only when loading the default program for the first time */
			if( bResetWhenLoaded ) {
				Reset( document.getElementById( 'InitialInput' ).value );
			}
		}
	};
	
	oRequest.open( "GET", zFileName, true );
	oRequest.send( null );
}

function x()
{
  /* For debugging */
}

function ClickTape()
{
	document.getElementById("InitialInput").focus();
	BlinkFont();
}

function EditTape(a) 
{
	Reset( document.getElementById( 'InitialInput' ).value );
}

function BlinkFont()
{
  document.getElementById("MachineTape").style.color="red";
  hTapeTimer=window.setTimeout("setBlinkFont()",700);
}

function setBlinkFont()
{
  document.getElementById("MachineTape").style.color="";
  hTapeTimer=window.setTimeout("BlinkFont()",700);
}

function stopBlink()
{
	if( hTapeTimer != null ) {
		window.clearInterval( hTapeTimer );
		hTapeTimer = null;
		document.getElementById("MachineTape").style.color="";
		Reset( document.getElementById( 'InitialInput' ).value );
	}
}