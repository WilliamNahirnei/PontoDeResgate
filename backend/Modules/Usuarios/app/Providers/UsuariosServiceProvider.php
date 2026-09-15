<?php

namespace Modules\Usuarios\Providers;

use Illuminate\Console\Scheduling\Schedule;
use Modules\Usuarios\Repositories\Contracts\UserRepositoryInterface;
use Modules\Usuarios\Repositories\UserRepository;
use Nwidart\Modules\Support\ModuleServiceProvider;

class UsuariosServiceProvider extends ModuleServiceProvider
{
    /**
     * The name of the module.
     */
    protected string $name = 'Usuarios';

    /**
     * The lowercase version of the module name.
     */
    protected string $nameLower = 'usuarios';

    /**
     * Command classes to register.
     *
     * @var string[]
     */
    // protected array $commands = [];

    /**
     * Provider classes to register.
     *
     * @var string[]
     */
    protected array $providers = [
        RouteServiceProvider::class,
    ];

    /**
     * Register the module's sub-providers and bind {@see UserRepositoryInterface}
     * to its Eloquent implementation.
     */
    public function register(): void
    {
        parent::register();

        $this->app->bind(UserRepositoryInterface::class, UserRepository::class);
    }

    /**
     * Define module schedules.
     *
     * @param  $schedule
     */
    // protected function configureSchedules(Schedule $schedule): void
    // {
    //     $schedule->command('inspire')->hourly();
    // }
}
