// see also AmbiguousCallTest.uc
class FunctionCallTest;

function Optional(optional Object obj, optional string str, optional Object obj2);

function Test()
{
    Optional();
    Optional(self);
    Optional(self,);
    Optional(self, "");
    Optional(, "");
    Optional(,,);
    Optional(,,self);
    Optional(self,,self);
    Optional(self,,self);
}
