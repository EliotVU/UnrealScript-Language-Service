class Class
	native;

var const native Object self;
var const native Object default;
var const native Class static;
var const native Class const;
var const native Class super;

native final function Class super(class Class);

native final function const vector vect( const float X, const float Y, const float Z ) const;

native final function const rotator rot( const int Pitch, const int Yaw, const int Roll ) const;

native final operator function Object new
(
   optional Object   InOuter,
   optional name     InName,
   optional int      InFlags,
   Class    		 InClass,
   optional Object   InTemplate
) const;