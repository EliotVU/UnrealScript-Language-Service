class ArchetypeOverrideTest extends ArchetypeTest;

function InternalOnMyDelegate(name param1, bool param2);

defaultproperties
{
    begin object name=archetype
        MyDelegate=InternalOnMyDelegate
    end object
}