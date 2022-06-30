// Examples of operators that break the parser, however these are quite extreme and are in most cases not used.
class AmbiguousOperatorTest extends Object;

// Valid in UC2, the UC parser is context sensitive.
// So for example if a DOT symbol is not expected then a preoperator with the name DOT symbol will be accepted.
// UC3 will not pickup some of these.
event Created()
{
	if(?vv);
	if(:vv);
	if(.vv);
	if({vv&&}vv);
}

// UC accepts any SYMBOL as an identifier
static final preoperator bool ? ( Object a );
static final preoperator bool : ( Object a );
static final preoperator bool . ( Object a );
static final preoperator bool ` ( Object a );
static final preoperator bool { ( Object a );
static final preoperator bool } ( Object a );