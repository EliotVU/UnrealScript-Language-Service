class Alpha extends Beta;

var Gamma GammaRef;

event Created()
{
	GammaRef.AlphaRef = self;

	Link.GammaRef.AlphaRef = self;
}

function AlphaTest();