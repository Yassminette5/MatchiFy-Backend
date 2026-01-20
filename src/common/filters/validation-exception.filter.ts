import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  BadRequestException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { ValidationError } from 'class-validator';

@Catch(BadRequestException)
export class ValidationExceptionFilter implements ExceptionFilter {
  catch(exception: BadRequestException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse();

    // Check if this is already a structured validation error (from our service)
    if (
      typeof exceptionResponse === 'object' &&
      exceptionResponse !== null &&
      'missingFields' in exceptionResponse &&
      'fieldErrors' in exceptionResponse
    ) {
      // Already in the correct format, return as-is
      response.status(status).json(exceptionResponse);
      return;
    }

    // Check if this is a validation error from class-validator
    if (
      typeof exceptionResponse === 'object' &&
      exceptionResponse !== null &&
      'message' in exceptionResponse
    ) {
      const message = exceptionResponse.message;
      
      // If message is an array (validation errors from class-validator)
      if (Array.isArray(message)) {
        const missingFields: string[] = [];
        const fieldErrors: Record<string, string> = {};

        message.forEach((error: string | ValidationError) => {
          if (typeof error === 'string') {
            // Simple string error - try to extract field name
            const fieldMatch = error.match(/^(\w+)\s/);
            if (fieldMatch) {
              const field = fieldMatch[1];
              missingFields.push(field);
              fieldErrors[field] = error;
            } else {
              // Try to extract field from common patterns
              const patterns = [
                /(\w+) should not be empty/i,
                /(\w+) must be a string/i,
                /(\w+) is required/i,
                /(\w+) must not be empty/i,
              ];
              
              let found = false;
              for (const pattern of patterns) {
                const match = error.match(pattern);
                if (match) {
                  const field = match[1].toLowerCase();
                  missingFields.push(field);
                  fieldErrors[field] = error;
                  found = true;
                  break;
                }
              }
              
              if (!found) {
                missingFields.push(error);
                fieldErrors[error] = error;
              }
            }
          } else if (typeof error === 'object' && 'property' in error) {
            // ValidationError object from class-validator
            const field = error.property;
            missingFields.push(field);
            const constraints = error.constraints || {};
            const firstConstraint = Object.values(constraints)[0] || `${field} is invalid`;
            fieldErrors[field] = firstConstraint;
          }
        });

        response.status(status).json({
          message: 'Validation failed',
          missingFields: [...new Set(missingFields)], // Remove duplicates
          fieldErrors,
        });
        return;
      }
    }

    // Default BadRequestException response
    response.status(status).json({
      message: exception.message || 'Bad request',
      missingFields: [],
      fieldErrors: {},
    });
  }
}

