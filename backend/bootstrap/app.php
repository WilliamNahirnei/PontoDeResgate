<?php

use Illuminate\Auth\AuthenticationException;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Modules\Usuarios\Http\Middleware\EnsureUserHasRole;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;
use Symfony\Component\HttpKernel\Exception\MethodNotAllowedHttpException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;
use Symfony\Component\HttpKernel\Exception\TooManyRequestsHttpException;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        // Aplicação é API-only (sem tela de login web), então convidados não
        // autenticados nunca devem ser redirecionados para uma rota "login".
        $middleware->redirectGuestsTo(fn () => null);

        $middleware->alias([
            'role' => EnsureUserHasRole::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*') || $request->expectsJson(),
        );

        // Estas mensagens vêm escritas em inglês no próprio framework, fora dos
        // arquivos de tradução (REQUISITOS.md §1.1: todas em português). As
        // mensagens próprias do sistema, como abort(403, '...'), são mantidas.
        $exceptions->render(function (Throwable $exception, Request $request) {
            if (! $request->is('api/*') && ! $request->expectsJson()) {
                return null;
            }

            $isHttpException = $exception instanceof HttpExceptionInterface;

            $message = match (true) {
                $exception instanceof AuthenticationException => 'Não autenticado.',
                $exception instanceof NotFoundHttpException => 'Recurso não encontrado.',
                $exception instanceof MethodNotAllowedHttpException => 'Método não permitido.',
                $exception instanceof TooManyRequestsHttpException => 'Muitas tentativas. Tente novamente mais tarde.',
                $exception instanceof AccessDeniedHttpException
                    && $exception->getMessage() === 'This action is unauthorized.' => 'Você não tem permissão para realizar esta ação.',
                // Com debug ligado, o erro detalhado continua aparecendo para quem desenvolve.
                ! $isHttpException
                    && ! $exception instanceof ValidationException
                    && ! $exception instanceof HttpResponseException
                    && ! config('app.debug') => 'Erro interno do servidor.',
                default => null,
            };

            if ($message === null) {
                return null;
            }

            return response()->json(
                ['message' => $message],
                match (true) {
                    $exception instanceof AuthenticationException => 401,
                    $isHttpException => $exception->getStatusCode(),
                    default => 500,
                },
                $isHttpException ? $exception->getHeaders() : [],
            );
        });
    })->create();
