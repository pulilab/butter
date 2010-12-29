(function( window, document, $, _, Popcorn ) { 

  _.mixin({
    //  Capitalize the first letter of the string
    capitalize : function( string ) {
      return string.charAt(0).toUpperCase() + string.substring(1).toLowerCase();
    },
    // Camel-cases a dashed string
    camel: function( string ) {
      return string.replace(/(\-[a-z])/g, function($1){return $1.toUpperCase().replace('-','');});
    },
    //  Zero pads a number
    pad: function( number ) {
      return ( number < 10 ? '0' : '' ) + number;
    },
    fourth: function( number ) {
      
      return ( Math.round(number * 4) / 4).toFixed(2);
    },
    // Convert an SMPTE timestamp to seconds
    smpteToSeconds: function( smpte ) {
      var t = smpte.split(":");

      if ( t.length === 1 ) {
        return parseFloat(t[0], 10);
      } 

      if (t.length === 2) {
        return parseFloat(t[0], 10) + parseFloat(t[1] / 12, 10);
      } 

      if (t.length === 3) {
        return parseInt(t[0] * 60, 10) + parseFloat(t[1], 10) + parseFloat(t[2] / 12, 10);
      } 

      if (t.length === 4) {
        return parseInt(t[0] * 3600, 10) + parseInt(t[1] * 60, 10) + parseFloat(t[2], 10) + parseFloat(t[3] / 12, 10);
      }
    }
  });

  //  Reusable Hash Tables
  
  
  var formats = {

    currentTime: function( float ) {
      
      
      var mm  = (""+ Math.round(float*100)/100 ).split(".")[1], 
          ss  = ( mm || "" );
      
      // this is awful.
      if ( ss.length === 1 ) {
        ss = ss + "0";
      }
      // this is awful.
      if ( !ss ) {
        ss = "00";
      }
       
      return  _( Math.floor( float / 3600 ) ).pad() + ":" + 
                _( Math.floor( float / 60 ) ).pad() + ":" + 
                  _( Math.floor( float % 60 ) ).pad() + ":" +
                    ( ss === "0" ? "00" : ss );// + float.split(".")[1]/1000
    }, 
    
    mp4: 'video/mp4; codecs="avc1, mp4a"',
    ogv: 'video/ogg; codecs="theora, vorbis"'
    
  };  
  
  $(function( ) { 
    
    var $popcorn, 
        $body = $("body"), 
        $doc = $(document),
        $video = $("video"), 

        $pluginSelectList = $("#ui-plugin-select-list"), 
        $editor = $("#ui-track-event-editor"),
        
        $uitracks = $("#ui-tracks"), 
        $tracks = $("#ui-tracks").children("div.track:not(.zoom)"),
        $tracktime = $("#ui-tracks-time"), 
        $scrubberHandle = $("#ui-scrubber-handle"),
        $currenttime = $("#current-time"), 
        $menucontrols = $(".ui-menu-controls"), 
        
        $videocontrols = $("#ui-video-controls"), 
        
        //$scrubber = $("#ui-scrubber"), 
        //$pluginSelect = $("#ui-plugin-select"), 
        //$addTrackButton = $("#ui-addtrackevent-button"), 
        //$editorPane = $("#ui-event-editor"),

        selectedEvent = null,
        lastSelectedEvent = null, 
        
        activeTracks = {};
        
    
    $("button,.ui-menu-controls").button();
    
    $("#ui-tools-accordion,#ui-track-details").accordion();


    var TrackEditor = ( function () {
      
      
      return {
        
        
        videoReady: function( $p, callback ) {
          
          //  Create an interval to check the readyState of the video
          var readyState = setInterval(function () {
            
            //  readyState has been satisfied
            if ( $p.video.readyState === 4 ) {
              
              
              //  execute callback if one was given
              callback && callback();
              
              //  clear the interval
              clearInterval( readyState );
            }

          }, 13);          
        
        
        }, 
        timeLineReady: function( $p, callback ) {
          
          //  Ensure the video timeline is ready
          TrackEditor.videoReady($p, function () {
            
            //  When ready, draw the timeline
            TrackEditor.drawTimeLine( $p.duration() );

            //  execute callback if one was given
            callback && callback();

          });
        }, 
        
        loadVideoFromUrl: function() {
          
          var url = $("#io-video-url").val(), 
              tokens = url.split("."), 
              type = tokens[ tokens.length - 1 ];
            
          
          //  Remove previously created video sources
          $video.children("source").remove();
          
          //  Create a new source element and append to the video element
          var $source = $("<source/>", {
            
            type: formats[ type ],
            src: url
          
          }).appendTo( "video" );
          
          //  Store the new Popcorn object in the cache reference
          $popcorn = Popcorn("#video");

          //  When new video and timeline are ready
          TrackEditor.timeLineReady( $popcorn, function () {
            
            //  Store refs to timeline canvas    
            var $timeline = $("#ui-tracks-time-canvas"), 
                increment = $timeline.width() / $popcorn.video.duration;
            
            
            
            if ( _.size( activeTracks ) ) {
              activeTracks = {};
            }
            
            //  Check for existing tracks and remove them, do not use cached reference
            if ( $(".track").length ) {
              $(".track").remove();
            }
            
            
            //  Check for existing elements inside the plugin panes
            if ( $(".ui-plugin-pane").children().length ) {
              $(".ui-plugin-pane").children().remove();
            }
            
            
            //  Listen on timeupdates
            $popcorn.listen( "timeupdate", function () {
              
              
              //  Updates the currenttime display
              $currenttime.val(function () {

                var $this = $(this), 
                    prop = _(this.id).camel(), 
                    val = $popcorn[ prop ]();

                return  formats[ prop ]( _(val).fourth() ) ;

              });
              
              //  console.log("timeupdate");
              //  Update the scrubber handle position              
              $("#ui-scrubber-handle").css({
                left: ( increment * $popcorn.video.currentTime ) + $timeline.position().left
              });

            });          
          });
                
        
        }, 
        
        deleteCanvas: function( parent, id ) {
          
          var canvas = document.getElementById(id);
          
          if ( canvas ) {
            document.getElementById(parent).removeChild( canvas );
          }
        
        }, 
        
        drawCanvas: function( parent, id, width, height ) {
          
          var canvas = document.createElement("canvas");
          
          canvas.id = id;
          canvas.width = width;
          canvas.height = height;
          
          document.getElementById(parent).appendChild(canvas);
          
          return canvas;
        }, 
        
        drawTimeLine: function( duration ) {

          TrackEditor.deleteCanvas( "ui-tracks-time", "ui-tracks-time-canvas" );
          TrackEditor.drawCanvas( "ui-tracks-time", "ui-tracks-time-canvas", 800, 20 );

          var context = document.getElementById("ui-tracks-time-canvas").getContext('2d'),
              tick = ( ( context.canvas.width-10 ) / duration ), 
              durationFloor = Math.floor(duration), 
              increment = tick/4, 
              offset = 2;

          context.font = "10px courier";
          context.fillStyle = "#000";
          
          for ( var i = 0, t = 0; i < duration * 2; i++ ) {

            if ( i >= 10 ) {
              offset = 4;
            }

            context.lineWidth = 1;
            context.beginPath();

            if ( i%2 || i === 0 ) {
              t++;
              
              if ( t <= durationFloor ) {
                context.fillText( t , t * tick - offset, 7);
              }

              var posOffset = i * tick/2;
              
              //  Secondary ticks
              for ( var f = 0; f < 4; f++ ) {
                context.moveTo( posOffset + ( f * increment ) -1, 15);
                context.lineTo( posOffset + ( f * increment ) -1, 20);                
              }
              

            } else {
              
              // Primary ticks
              context.moveTo( i * tick/2 -1, 10);
              context.lineTo( i * tick/2 -1, 20);
            
            }

            context.stroke();
          }
        }   
      };
      
    })();
    
    
    var TrackEvents = ( function () {
      
      
      return {
      
        addTrackEvent: function() {

          var $track, lastEventId, trackEvents, trackEvent, settings = {}, 
              trackType = this.id, 
              trackManifest = Popcorn.manifest[ trackType ], 
              startWith = {
                start: 2,
                end: 10
              };


          arguments.length && ( settings = arguments[0] );

          
          //  In case settings is an event object
          if ( settings.currentTarget ) {
            settings  = {};
          }


          //  Compile a starting point
          _.extend( startWith, settings, {

            target: Popcorn.manifest[ trackType ].options.target

          });

          //  Explicitly augment the starting object with all manifest props
          _.forEach( trackManifest.options, function ( obj, key ) {
            if ( !( key in startWith ) ) {
              startWith[ key ] = "";
            }
          });

          console.log(startWith);
          //  Call the plugin to create an empty track event
          $popcorn[ trackType ]( startWith );

          
          //  Obtain the last registered track event id
          lastEventId = $popcorn.getLastTrackEventId();
          
          
          //  Obtain all current track events
          trackEvents = $popcorn.getTrackEvents();


          //  Capture this track event
          trackEvent = trackEvents[ trackEvents.length - 1 ];

          
          //  Check for existing tracks of this type
          //  If no existing tracks, create them
          if ( !activeTracks[ trackType ] ) {

            //  Draw a new track placeholder
            $track = $("<div/>", {

              "title": trackType, 
              className: "span-21 last track track" + ( $tracks.length + 1 )

            }).prependTo( "#ui-tracks" );

            //  Convert the placeholder into a track, with a track event
            $track.track({
              target: $('#video'),
              duration: $popcorn.video.duration
            });


            $track.prepend('<span class="large track-label large" >' + _( trackType ).capitalize() + '</span>');

            //  Cache the track widget
            activeTracks[ trackType ] = $track;

          } else {

            //  If a track of this type exists
            $track = activeTracks[ trackType ];

          }
          

          $track.track( 'addTrackEvent', {
            inPoint           : startWith.start,
            outPoint          : startWith.end,
            type              : trackType,
            popcornEvent      : trackEvent,
            popcorn           : $popcorn,
            _id               : lastEventId, 
            editEvent         : function() {  

              //console.log("TrackEvent clicked");


              TrackEvents.drawTrackEvents.call(this); 

            }
          });

          $editor.dialog({
            width: "400px",
            autoOpen: false,
            title: 'Edit ' + _( trackType ).capitalize(),
            buttons: {
              //'Delete': editEventDelete,
              'Cancel': TrackEvents.editEventCancel,
              'OK'    : function () {

                TrackEvents.editEventApply.call(trackEvent); 

                $(this).dialog("close");
              },
              'Apply' : TrackEvents.editEventApply
            }
          });        

          $doc.trigger( "addTrackComplete.track" );

        },
        
        
        drawTrackEvents: function() { 



          // THIS FUNCTION IS NOT ACTUALLY EDITTING, BUT CREATING THE EDITOR DIALOG


          try{ $editor.dialog("close"); }
          catch(e ) {  if ( console && console.log ) {  console.log(e); } }

          // `this` will actually refer to the context set when the function is called.
          selectedEvent = this;    


          var manifest    = selectedEvent.popcornEvent.natives.manifest,
              about       = manifest.about,
              aboutTab    = $editor.find(".about"),
              options     = manifest.options,
              optionsTab  = $editor.find(".options"),

              input,
              label
          ;

          //console.log(manifest);

          aboutTab.children("*").remove(); // Rick, not sure if this is good practice here. Any ideas?

          $("<h3/>").text(about.name).appendTo(aboutTab);
          $("<p/>").html("<label>Version:</label> "+about.version).appendTo(aboutTab);
          $("<p/>").html("<label>Author:</label> "+about.author).appendTo(aboutTab);
          $("<a/>").html('<label>Website:</label> <a href="'+about.website+'">'+about.website+'</a>').appendTo(aboutTab);

          optionsTab.children("*").remove(); // Rick, not sure if this is good practice here. Any ideas?

         //console.log(manifest);

          if ( !selectedEvent.manifestElems ) {  
            selectedEvent.manifestElems = {}; 
          }

          if ( !selectedEvent.previousValues ) {  
            selectedEvent.previousValues = {}; 
          }

          for ( var i in options ) { 

            if ( typeof options[i] === "object" ) {

              var opt = options[i],
                  elemType = opt.elem,
                  elemLabel = opt.label, 
                  elem;

              elem = $("<"+elemType+"/>", {
                        className: "text"
                      });


              selectedEvent.manifestElems[i] = elem;

              //if ( lastSelectedEvent != selectedEvent ) { 
                selectedEvent.previousValues[i] = selectedEvent.popcornEvent[i];
              //}

              label = $("<label/>").attr('for', elemLabel).text(elemLabel);   
              
              
              if ( elemType === "input" ) { 
                
                elem.val( selectedEvent.popcornEvent[i] );
              }
              
              if ( elemType === "select" ) {
                
                _.each( opt.options, function( type ) {
                  
                  $("<option/>", {
                    
                    value: type, 
                    text: _( type ).capitalize()
                  
                  }).appendTo( elem );
                
                });
                
              
              }

              elem.appendTo(label);
              label.appendTo(optionsTab);
              

              
            }
          }

          lastSelectedEvent = this;


          $editor.dialog("open");
        },
        
        
        editEventApply: function() { 


          //console.log("selectedEvent", selectedEvent);
          //console.log("selectedEvent.type", selectedEvent.type); // <--- use to call plugin FN

          var popcornEvent = selectedEvent.popcornEvent,
              manifest = popcornEvent.natives.manifest;

          //console.log("manifest", manifest);
          //console.log("popcornEvent", popcornEvent);

          for( var i in manifest.options ) { 
            if ( typeof manifest.options[i] === "object" ) {
              
              var _val = selectedEvent.manifestElems[i].val();
            
              popcornEvent[i] = _val;
              
              
              if ( !!_val && ["start","end"].indexOf(i) === -1 && !isNaN( _val )  ) {
                popcornEvent[i] = +_val;
              }
            }
          }

          //$popcorn.removeTrackEvent( selectedEvent._id );
          //console.log(popcornEvent);
          //TrackEvents.addTrackEvent.call({ id: selectedEvent.type, _id: selectedEvent._id }, popcornEvent);



          //selectedEvent.type

          selectedEvent.inPoint = popcornEvent.start;
          selectedEvent.outPoint = popcornEvent.end;
          
          
          // check for empty stuff
          
          $("#" + selectedEvent.popcornEvent.target).children().each(function () {
            
            if ( $(this).html() === "" ) {
              $(this).remove();
            }
          
          });
          
          //console.log(selectedEvent.popcornEvent.natives._setup(selectedEvent.popcornEvent) );
          
          //  Recall _setup with new data
          selectedEvent.popcornEvent.natives._setup(selectedEvent.popcornEvent)
        
          selectedEvent.parent._draw();


          // TODO:  move out to own function
          // $("#data-view").val( JSON.stringify( $popcorn.data.trackEvents ) );
        }, 
        
        
        editEventCancel: function( ) { 
          var popcornEvent = selectedEvent.popcornEvent;

          for( var i in selectedEvent.previousValues ) { 
            if ( i ) {
              popcornEvent[i] = selectedEvent.previousValues[i];
            }
          }
          selectedEvent.inPoint = popcornEvent.start;
          selectedEvent.outPoint = popcornEvent.end;
          selectedEvent.parent._draw();
          $editor.dialog("close");
        },
        
        
        editEventOK: function() { 
          TrackEvents.editEventApply();
          $editor.dialog("close");
        }
      };
    
    })();
    
    
    
    
    $("#io-video-url").bind( "change", TrackEditor.loadVideoFromUrl ).trigger("change")
    
    
    
    
    
    
    

    // to do: rewire all refs to .natives.manifest

    $editor.tabs();
    $editor.css({display:"none"});
    
    
    //  Load plugins to ui-plugin-select-list
    _.each( Popcorn.registry, function ( plugin, v ) {
      
      
      // todo: convert to templates
      var $li = $("<li/>", {
        
        id: plugin.type, 
        className: "span-4 select-li clickable",
        html: "<h3><img class='icon' src='img/dummy.png'> " + _( plugin.type ).capitalize() + "</h3>"
        
      }).appendTo( "#ui-plugin-select-list" );      

    });


    $pluginSelectList.delegate( "li", "click", function (event) {

      
      console.log(this, event);  
      
      TrackEvents.addTrackEvent.call(this, event);

      
    
    });
    

    // this is awful  
    $("#ui-plugin-select-list li")
      .hover(function () {
        $(this).animate({ backgroundColor: "#ffff7e" }, 200);
      }, 
      function () {
        $(this).animate({ backgroundColor: "#FFFFFF" }, 200);
    });  
    
    
    
    
    $scrubberHandle.draggable({ 
      axis: "x", 
      containment: "#ui-tracks",  
      drag: function (event, ui) {
          
        //console.log($tracktime.position().left);
        
        
        var scrubPosition = ( ui.offset.left + 5 ) - $tracktime.position().left, 
            updateTo = $popcorn.video.duration / $tracktime.width() * scrubPosition, 
            tolerance = ( $popcorn.video.duration / $tracktime.width() ) / 4;
            
        
        $popcorn.currentTime( _( updateTo ).fourth() );
      }
    });

    
    
    $body.disableSelection();
    $uitracks.disableSelection();
    
    
    $doc.bind( "addTrackComplete.track" , function( event ) {
      
      //console.log("addTrackComplete.track");
      //console.log( event );
      
      $("#ui-scrubber,#ui-scrubber-handle").css({
        height: $uitracks.height()
      });
    });
    

    

    
    
    
    // movie into track editor object, fix redundancies
    
    var seekTo = 0;
    
    var controls = {
      
      load: function () {
      
        TrackEditor.loadVideoFromUrl();
      
      }, 
      play: function () {
        
        $popcorn.video.play();
      }, 
      pause: function () {
        
        $popcorn.video.pause();
      }, 
      seek: function ( option ) {
      
        //var seekTo;
        
        if ( option.indexOf(":") > -1 ) {
          
          var $input = $("#" + ( option.split(":")[1] || "" ) );
          
          seekTo = _( $input.val() ).smpteToSeconds();
        }
        

        if ( option === "first" ) {
          seekTo = 0;
        }

        if ( option === "prev" ) {
          
          //console.log( _($popcorn.video.currentTime).fourth() );
          
          seekTo = _($popcorn.video.currentTime - 0.25).fourth();
        }

        if ( option === "next" ) {
          
          //console.log(_($popcorn.video.currentTime).fourth());
        
          seekTo = _($popcorn.video.currentTime + 0.25).fourth();
        }

        if ( option === "end" ) {
          seekTo = $popcorn.video.duration;
        }        
        
        
        if ( seekTo > $popcorn.video.duration ) {
          seekTo = $popcorn.video.duration;
        }

        if ( seekTo < 0 ) {
          seekTo = 0;
        }        
        
        $popcorn.video.currentTime = seekTo;
        
      }       
    };
    
    

    
    $videocontrols.children("button").bind( "click", function ( event ) {
      
      // was elegant, now its not. needs to be fixed
      var $this = $(this).children("span").children("span");
      
      
      controls[ $this.attr("data-control") ]( $this.attr("data-opt") );

    });
    
    
    $menucontrols.bind( "click", function( event ) {
      
      event.preventDefault();
      
      var $this = $(this);
      
      controls[ $this.attr("data-control") ]();
    
    
    });
    

    //  TODO: Revise
    $currenttime.bind( "keydown", function ( event ) {

      if ( event.which === 13 ) {
        $('#current-time').next().trigger("click");          
      }
      
      if ( event.which === 39 ) {
        $('[data-opt="next"]').parents("button").trigger("click");
      }
      
      if ( event.which === 37 ) {
        $('[data-opt="prev"]').parents("button").trigger("click");
      }
      
    });
    
    
    
    
    
    window.$popcorn = $popcorn;
  });

})( this, this.document, this.jQuery, this._, this.Popcorn );
//  Pass ref to jQuery and Underscore.js