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

## PublishEvent(EventID, Actor):Result<EventDetail, EventError>
Success Example: {ok: true, value: { event: PublishedEvent, permissions: { canPublish: false, canCancel: true } }}
Failing Example:
{ok:false, error: new UnauthorizedEventAction("Only the organizer or an admin can publish this event.")}
{ok:false, error: new InvalidEventTransition("Only draft events can be published.")}
{ok:false, error: new EventNotFound("Event not found.")}

## CancelEvent(EventID, Actor):Result<EventDetail, EventError>
Success Example: {ok: true, value: { event: CancelledEvent, permissions: { canPublish: false, canCancel: false } }}
Failing Example:
{ok:false, error: new UnauthorizedEventAction("Only the organizer or an admin can cancel this event.")}
{ok:false, error: new InvalidEventTransition("Only published events can be cancelled.")}
{ok:false, error: new EventNotFound("Event not found.")}

## ListPublishedEvents(Filters):Result<EventList, EventError>
Success Example: {ok: true, value: { events: [Event1, Event2], filters: { category: "social", timeframe: "this-week" } }}
Failing Example:
{ok:false, error: new InvalidFilter("Category filter is invalid.")}
{ok:false, error: new InvalidFilter("Timeframe filter is invalid.")}