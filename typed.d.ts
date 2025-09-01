declare global {
    namespace App {
        type Selection = {
            sx: number;
            sy: number;
            dx: number;
            dy: number;
        };
    }

    interface HTMLElement {
        [key: string]: any;
    }
}

export {};
