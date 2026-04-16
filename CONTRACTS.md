# Service Contracts

- Success: `{ ok: true, value: ... }`
- Failure: `{ ok: false, value: error }`

## AuthService

### `authenticate(input: LoginInput): Promise<Result<IAuthenticatedUser, AuthError>>`
- Success example:
  `{ ok: true, value: AuthenticatedUser }`
- Failure examples:
  `{ ok: false, value: ValidationError("Email is required.") }`
  `{ ok: false, value: ValidationError("Password is required.") }`
  `{ ok: false, value: InvalidCredentials("Invalid email or password.") }`
  `{ ok: false, value: UnexpectedDependencyError("...") }`

## AdminUserService

### `listUsers(): Promise<Result<IUserSummary[], AuthError>>`
- Success example:
  `{ ok: true, value: [UserSummary1, UserSummary2] }`
- Failure example:
  `{ ok: false, value: UnexpectedDependencyError("...") }`

### `createUser(input: CreateUserInput): Promise<Result<IUserSummary, AuthError>>`
- Success example:
  `{ ok: true, value: UserSummary }`
- Failure examples:
  `{ ok: false, value: ValidationError("Display name is required.") }`
  `{ ok: false, value: ValidationError("Email must look like an email address.") }`
  `{ ok: false, value: ValidationError("Password must be at least 8 characters.") }`
  `{ ok: false, value: UserAlreadyExists("A user with that email already exists.") }`
  `{ ok: false, value: UnexpectedDependencyError("...") }`

### `deleteUser(id: string, actingUserId: string): Promise<Result<void, AuthError>>`
- Success example:
  `{ ok: true, value: undefined }`
- Failure examples:
  `{ ok: false, value: ValidationError("User ID is required.") }`
  `{ ok: false, value: ProtectedUserOperation("Admin users cannot remove their own account.") }`
  `{ ok: false, value: UserNotFound("User not found.") }`
  `{ ok: false, value: UnexpectedDependencyError("...") }`

## EventService

### `Toggle(eventId: number, userId: string): Promise<Result<string, EventError>>`
- Success example:
  `{ ok: true, value: "RSVP updated" }`
- Failure examples:
  `{ ok: false, value: EventNotFoundError("Event with ID 12 not found") }`
  `{ ok: false, value: UserNotFoundError("User with ID user-1 not found") }`

### `Search(query: string, viewerId?: string): Promise<Result<IEvent[], EventError>>`
- Success example:
  `{ ok: true, value: [Event1, Event2] }`
- Failure example:
  `{ ok: false, value: UnknownError("Search failed") }`

### `createEvent(input: CreateEventInput, organizerId: string): Promise<Result<IEvent, CreateEventError>>`
- Success example:
  `{ ok: true, value: Event }`
- Failure examples:
  `{ ok: false, value: InvalidInputError("Organizer ID is required") }`
  `{ ok: false, value: InvalidInputError("Title is required") }`
  `{ ok: false, value: InvalidInputError("End time must be after start time") }`
  `{ ok: false, value: InvalidInputError("Capacity must be a positive integer") }`

### `getEventById(eventId: string, viewerId?: string): Promise<Result<IEvent, GetEventError>>`
- Success example:
  `{ ok: true, value: Event }`
- Failure examples:
  `{ ok: false, value: EventNotFoundError("Event not found") }`
  `{ ok: false, value: ForbiddenError("Draft event not accessible") }`
  `{ ok: false, value: UnexpectedDependencyError("...") }`

### `listPublishedEvents(input: EventListInput, viewerId?: string, now?: Date): Promise<Result<EventListResult, EventError>>`
- Success example:
  `{ ok: true, value: { events: [Event1, Event2], filters: { category: "social", timeframe: "this-week", query: "" }, availableCategories: [...], availableTimeframes: [...] } }`
- Failure examples:
  `{ ok: false, value: InvalidInputError("Category filter is invalid.") }`
  `{ ok: false, value: InvalidInputError("Timeframe filter is invalid.") }`
  `{ ok: false, value: UnexpectedDependencyError("...") }`

### `getEventDetail(eventId: string, actor: EventActor, now?: Date): Promise<Result<EventDetailResult, EventError>>`
- Success example:
  `{ ok: true, value: { event: Event, permissions: { canPublish: false, canCancel: true } } }`
- Failure examples:
  `{ ok: false, value: EventNotFoundError("Event not found.") }`
  `{ ok: false, value: ForbiddenError("You do not have access to this event.") }`
  `{ ok: false, value: UnexpectedDependencyError("...") }`

### `publishEvent(eventId: string, actor: EventActor, now?: Date): Promise<Result<EventDetailResult, EventError>>`
- Success example:
  `{ ok: true, value: { event: PublishedEvent, permissions: { canPublish: false, canCancel: true } } }`
- Failure examples:
  `{ ok: false, value: ForbiddenError("Only the organizer or an admin can publish this event.") }`
  `{ ok: false, value: InvalidInputError("Only draft events can be published.") }`
  `{ ok: false, value: EventNotFoundError("Event not found.") }`
  `{ ok: false, value: UnexpectedDependencyError("...") }`

### `cancelEvent(eventId: string, actor: EventActor, now?: Date): Promise<Result<EventDetailResult, EventError>>`
- Success example:
  `{ ok: true, value: { event: CancelledEvent, permissions: { canPublish: false, canCancel: false } } }`
- Failure examples:
  `{ ok: false, value: ForbiddenError("Only the organizer or an admin can cancel this event.") }`
  `{ ok: false, value: InvalidInputError("Only published events can be cancelled.") }`
  `{ ok: false, value: EventNotFoundError("Event not found.") }`
  `{ ok: false, value: UnexpectedDependencyError("...") }`

### `getGroupedAttendees(eventId: number, userId: string, role: string): Promise<Result<any, EventError>>`
- Success example:
  `{ ok: true, value: { going: [...], waitlisted: [...], cancelled: [...] } }`
- Failure examples:
  `{ ok: false, value: EventNotFoundError("Event not found") }`
  `{ ok: false, value: ForbiddenError("Not allowed to view attendees") }`

### `getMyRSVPs(userId: string): Promise<Result<any, EventError>>`
- Success example:
  `{ ok: true, value: { going: [...], waitlisted: [...], cancelled: [...] } }`
- Failure example:
  `{ ok: false, value: UnknownError("Failed to fetch RSVPs") }`

## CommentService

### `listComments(eventId: number): Promise<Result<ICommentWithAuthor[], CommentError>>`
- Success example:
  `{ ok: true, value: [CommentWithAuthor1, CommentWithAuthor2] }`
- Failure example:
  `{ ok: false, value: CommentEventNotFound(eventId) }`

### `postComment(eventId: number, userId: string, content: string): Promise<Result<ICommentWithAuthor, CommentError>>`
- Success example:
  `{ ok: true, value: CommentWithAuthor }`
- Failure examples:
  `{ ok: false, value: EmptyContent() }`
  `{ ok: false, value: CommentEventNotFound(eventId) }`

### `deleteComment(commentId: string, requestingUserId: string, requestingUserRole: string, eventOrganizerId: string): Promise<Result<boolean, CommentError>>`
- Success example:
  `{ ok: true, value: true }`
- Failure examples:
  `{ ok: false, value: CommentNotFound(commentId) }`
  `{ ok: false, value: UnauthorizedDeletion() }`