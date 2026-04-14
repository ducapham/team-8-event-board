## GetCurrentStatus(UserID):Result<Status, GetStatusError>
Success Example: {ok: true, value: Attending}
Failing Example: {ok:false, error: new InvalidStatusError("Status invalid")}

## Toggle(UserID, EventID):Result<Status, RVSPError>
Success Example: {ok:true, value:Waitlist}
Failing Example: {ok:false, error: new InvalidUserError("User doesn't exist for event cancelling")}

## Search(EventName):Result<Event[], SearchError>
Success Example: {ok: true, value: [Event1, Event2]}
Failing Example: {ok: false, error: new NetworkError("The system failed to search. Try again")}

## CreateEvent(Input, OrganizerID):Result<Event, CreateEventError>
Success Example: {ok: true, value: Event}
Failing Example: {ok:false, error: new InvalidInputError("End time must be after start time")}

## GetEventByID(EventID, UserID):Result<Event, GetEventError>
Success Example: {ok: true, value: Event}
Failing Example: 
{ok:false, error: new EventNotFoundError("Event not found")}
{ok:false, error: new ForbiddenError("Draft event not accessible")}