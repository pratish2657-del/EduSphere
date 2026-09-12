class EduSphereError(Exception):
    """Base exception for expected application errors."""


class BadRequestError(EduSphereError):
    """Invalid business request."""


class UnauthorizedError(EduSphereError):
    """Authentication is required."""


class ForbiddenError(EduSphereError):
    """Authenticated user is not allowed to perform the action."""


class NotFoundError(EduSphereError):
    """Requested resource does not exist."""


class ConflictError(EduSphereError):
    """Request conflicts with existing application state."""


class ServiceUnavailableError(EduSphereError):
    """A required external service is unavailable."""
