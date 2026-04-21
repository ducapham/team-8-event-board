import { PrismaClient } from "@prisma/client";
import {Err, Ok, Result} from "../lib/result";
import { EventError, EventNotFoundError, UserNotFoundError, RSVPNotAllowedError, UnexpectedDependencyError } from "../lib/errors.js";
