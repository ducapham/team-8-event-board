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

## GetGroupedAttendees(EventID, RequestingUserID, RequestingUserRole):Result<GroupedAttendees, AttendeeListError>
Success Example: {ok: true, value: { going: [User1, User2], waitlisted: [User3], cancelled: [] }}
Failing Example:
{ok: false, error: new EventNotFound("Event not found.")}
{ok: false, error: new Unauthorized("Only the organizer or an admin can view the attendee list.")}

## ListComments(EventID):Result<ICommentWithAuthor[], CommentError>
Success Example: {ok: true, value: [{ id: "c1", eventId: 1, userId: "u1", content: "Great event!", authorName: "Alice", createdAt: Date }]}
Failing Example:
{ok: false, error: new EventNotFound("Event not found.")}

## PostComment(EventID, UserID, Content):Result<ICommentWithAuthor, CommentError>
Success Example: {ok: true, value: { id: "c2", eventId: 1, userId: "u2", content: "See you there!", authorName: "Bob", createdAt: Date }}
Failing Example:
{ok: false, error: new EmptyContent("Comment content cannot be empty.")}
{ok: false, error: new EventNotFound("Event not found.")}

## DeleteComment(CommentID, RequestingUserID, RequestingUserRole, EventOrganizerID):Result<boolean, CommentError>
Success Example: {ok: true, value: true}
Failing Example:
{ok: false, error: new CommentNotFound("Comment not found.")}
{ok: false, error: new UnauthorizedDeletion("Only the author, organizer, or admin can delete this comment.")}