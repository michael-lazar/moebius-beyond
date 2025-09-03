declare global {
    namespace App {
        type Selection = {
            sx: number;
            sy: number;
            dx: number;
            dy: number;
        };

        type Blocks = {
            columns: number;
            rows: number;
            data: any[]; // TODO
            transparent?: boolean;
        };

        type Block = {
            code: number;
            bg: number;
            fg: number;
        };

        type Render = {
            columns: number;
            rows: number;
            width: number;
            height: number;
            ice_color_collection: HTMLCanvasElement[];
            blink_on_collection: HTMLCanvasElement[];
            blink_off_collection: HTMLCanvasElement[];
            preview_collection: HTMLCanvasElement[];
            maximum_rows: number;
            font: any; // TODO
        };

        type Color = {
            r: number;
            g: number;
            b: number;
        };
    }

    interface HTMLElement {
        [key: string]: any;
    }
}

export {};
